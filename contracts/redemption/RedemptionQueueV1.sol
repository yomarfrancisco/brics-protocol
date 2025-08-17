// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface ISovereignBufferController {
    // Draw stablecoins (or settlement asset) to `to`.
    // Implementation should enforce its own limits/invariants.
    function drawdown(address to, uint256 amount) external;
}

interface IBRICSTokenV1Like {
    function totalSupply() external view returns (uint256);
    function burnFrom(address owner, uint256 amount) external; // OPTIONAL (if token chooses to burn first, we won't use this)
}

/// @notice Dual-lane redemption queue: instant (buffer-backed) + monthly window (pro-rata, pull claims).
/// @dev Delta-only friendly; no storage-heavy iteration on settlement (pull model via settlement factor).
contract RedemptionQueueV1 is AccessControl {
    // ───────────────────────────────────────────────────────────────
    // Roles
    // ───────────────────────────────────────────────────────────────
    bytes32 public constant LIMITS_ROLE   = keccak256("LIMITS_ROLE");
    bytes32 public constant SETTLER_ROLE  = keccak256("SETTLER_ROLE");
    bytes32 public constant TOKEN_ROLE    = keccak256("TOKEN_ROLE");

    // ───────────────────────────────────────────────────────────────
    // External dependencies
    // ───────────────────────────────────────────────────────────────
    address public token;                    // BRICSTokenV1
    address public bufferController;         // SovereignBufferControllerV1 (or adapter)

    // ───────────────────────────────────────────────────────────────
    // Instant lane controls
    // ───────────────────────────────────────────────────────────────
    uint256 public instantDailyLimit;        // e.g. 100_000e6
    uint256 public instantPerTxLimit;        // e.g. 10_000e6
    mapping(uint256 => uint256) public instantSpentByDay; // dayIndex => spent

    // ───────────────────────────────────────────────────────────────
    // Monthly windowed lane (pull model)
    // Users enqueue principal into a strike window; on finalize, we set a settlement factor (RAY).
    // Users then call claim(strike) to pull settlement funds from buffer.
    // ───────────────────────────────────────────────────────────────
    struct Window {
        uint256 totalRequested;  // sum of requested amounts
        uint256 settlementRay;   // pro-rata factor in RAY (1e27). 1e27 == 100% filled
        bool    finalized;       // set on settleWindow(...)
    }
    mapping(uint256 => Window) public windows;                      // strikeTs => Window
    mapping(uint256 => mapping(address => uint256)) public requestedBy; // strikeTs => user => amount (unclaimed)

    // ───────────────────────────────────────────────────────────────
    // Events
    // ───────────────────────────────────────────────────────────────
    event LimitsSet(uint256 daily, uint256 perTx);
    event TokenSet(address token);
    event BufferControllerSet(address buffer);
    event InstantRedeemed(address indexed user, uint256 amount, uint256 dayIndex, uint256 spentToday);
    event WindowEnqueued(address indexed user, uint256 indexed strikeTs, uint256 amount, uint256 totalRequested);
    event WindowFinalized(uint256 indexed strikeTs, uint256 fundsProvided, uint256 settlementRay);
    event WindowClaimed(address indexed user, uint256 indexed strikeTs, uint256 requestAmt, uint256 payout);

    // ───────────────────────────────────────────────────────────────
    // Errors
    // ───────────────────────────────────────────────────────────────
    error NotToken();
    error ZeroAddress();
    error InvalidAmount();
    error LimitsExceeded();
    error WindowFinalizedAlready();
    error WindowNotFinalized();

    // ───────────────────────────────────────────────────────────────
    // Constructor
    // ───────────────────────────────────────────────────────────────
    constructor(
        address _admin,
        address _token,
        address _bufferController,
        uint256 _daily,
        uint256 _perTx
    ) {
        if (_admin == address(0) || _token == address(0) || _bufferController == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(LIMITS_ROLE, _admin);
        _grantRole(SETTLER_ROLE, _admin);
        _grantRole(TOKEN_ROLE, _token);

        token = _token;
        bufferController = _bufferController;
        instantDailyLimit = _daily;
        instantPerTxLimit = _perTx;

        emit TokenSet(_token);
        emit BufferControllerSet(_bufferController);
        emit LimitsSet(_daily, _perTx);
    }

    // ───────────────────────────────────────────────────────────────
    // Views
    // ───────────────────────────────────────────────────────────────
    function currentDayIndex() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function instantRemainingToday() public view returns (uint256) {
        uint256 spent = instantSpentByDay[currentDayIndex()];
        return spent >= instantDailyLimit ? 0 : (instantDailyLimit - spent);
    }

    // helpers for token routing
    function instantPerTxLimitView() external view returns (uint256) {
        return instantPerTxLimit;
    }

    // ───────────────────────────────────────────────────────────────
    // Admin
    // ───────────────────────────────────────────────────────────────
    function setInstantLimits(uint256 daily, uint256 perTx) external onlyRole(LIMITS_ROLE) {
        instantDailyLimit = daily;
        instantPerTxLimit = perTx;
        emit LimitsSet(daily, perTx);
    }

    function setToken(address _token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_token == address(0)) revert ZeroAddress();
        // swap TOKEN_ROLE
        if (token != address(0)) _revokeRole(TOKEN_ROLE, token);
        token = _token;
        _grantRole(TOKEN_ROLE, _token);
        emit TokenSet(_token);
    }

    function setBufferController(address _buffer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_buffer == address(0)) revert ZeroAddress();
        bufferController = _buffer;
        emit BufferControllerSet(_buffer);
    }

    // ───────────────────────────────────────────────────────────────
    // Instant lane (token calls AFTER it burns user's tokens)
    // ───────────────────────────────────────────────────────────────
    /// @dev callable ONLY by token after burning the user's amount.
    function redeemSmallAfterBurn(address user, uint256 amount) external onlyRole(TOKEN_ROLE) {
        if (amount == 0) revert InvalidAmount();
        if (amount > instantPerTxLimit) revert LimitsExceeded();

        uint256 dayIdx = currentDayIndex();
        uint256 spent = instantSpentByDay[dayIdx];
        if (spent + amount > instantDailyLimit) revert LimitsExceeded();

        instantSpentByDay[dayIdx] = spent + amount;
        ISovereignBufferController(bufferController).drawdown(user, amount);

        emit InstantRedeemed(user, amount, dayIdx, instantSpentByDay[dayIdx]);
    }

    // ───────────────────────────────────────────────────────────────
    // Windowed lane (enqueue + finalize + user claim)
    // ───────────────────────────────────────────────────────────────
    /// @dev token records the user's queued amount AFTER burn.
    function enqueueAfterBurn(address user, uint256 amount, uint256 strikeTs) external onlyRole(TOKEN_ROLE) {
        if (amount == 0) revert InvalidAmount();
        Window storage w = windows[strikeTs];
        if (w.finalized) revert WindowFinalizedAlready();

        requestedBy[strikeTs][user] += amount;
        w.totalRequested += amount;
        emit WindowEnqueued(user, strikeTs, amount, w.totalRequested);
    }

    /// @notice finalize the window with funds available. Sets settlement factor (RAY), and marks finalized.
    /// @param fundsProvided total funds buffer can dedicate to this window (in settlement asset units)
    function finalizeWindow(uint256 strikeTs, uint256 fundsProvided) external onlyRole(SETTLER_ROLE) {
        Window storage w = windows[strikeTs];
        if (w.finalized) revert WindowFinalizedAlready();

        // settlementRay = min(1, funds / totalRequested) in RAY (1e27)
        uint256 ray = 1e27;
        if (w.totalRequested == 0) {
            w.settlementRay = 0; // nothing to pay
        } else {
            // clamp at 1.0 in RAY
            uint256 raw = (fundsProvided * ray) / w.totalRequested;
            w.settlementRay = raw > ray ? ray : raw;
        }
        w.finalized = true;
        emit WindowFinalized(strikeTs, fundsProvided, w.settlementRay);
    }

    /// @notice user pulls the settlement payout (pro-rata) from buffer; zeroes their request.
    function claim(uint256 strikeTs) external {
        Window storage w = windows[strikeTs];
        if (!w.finalized) revert WindowNotFinalized();

        uint256 req = requestedBy[strikeTs][msg.sender];
        if (req == 0) revert InvalidAmount();

        requestedBy[strikeTs][msg.sender] = 0;
        uint256 payout = (req * w.settlementRay) / 1e27;

        if (payout > 0) {
            ISovereignBufferController(bufferController).drawdown(msg.sender, payout);
        }
        emit WindowClaimed(msg.sender, strikeTs, req, payout);
    }

    // ───────────────────────────────────────────────────────────────
    // Utility
    // ───────────────────────────────────────────────────────────────
    /// @notice Compute next window strike (UTC month-end 00:00). Simple helper; token may compute externally too.
    function nextMonthStrikeTs(uint256 ts) external pure returns (uint256) {
        // naive month math: treat months as 30d buckets for MVP; can refine later in a lib
        // strike at the next 30-day boundary from epoch
        uint256 d = 30 days;
        uint256 n = (ts / d) + 1;
        return n * d;
    }
}
