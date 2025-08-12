// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// NOTE: Refactor to adopt Queued -> Struck -> Settled lifecycle.
//       Strike no longer settles; settlement is explicit and T+5‑bounded.

interface IUSDC {
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IRedemptionClaim {
    function mint(address to, uint256 amount) external returns (uint256 claimId);
    function burn(uint256 claimId) external;
}

interface IRedemptionQueue {
    function enqueue(address member, uint256 amount, uint8 lane) external returns (uint256 claimId);
    function processStrike(uint256[] calldata claimIds, uint256 navRay) external;
    function markSettled(uint256 claimId, uint256 usdcPaid) external;
    // view accessor used by settleClaim
    function claims(uint256) external view returns (
        uint256 tokens,
        uint256 usdcOwed,
        uint8   status,    // 0=Queued,1=Struck,2=Settled
        uint64  struckAt,
        address owner,
        uint8   lane
    );
}

interface INAVOracle {
    function latestNAVRay() external view returns (uint256 navRay);
}

interface IConfigRegistryLike {
    function getUint(bytes32 key) external view returns (uint256);
}

interface IInstantLaneLike {
    function canInstantRedeem(address member, uint256 tokens18) external view returns (bool ok, uint256 capUSDC, uint256 usedUSDC, uint256 needUSDC);
    function instantRedeem(uint256 tokens18) external returns (uint256 usdcOut);
    function instantRedeemFor(address member, uint256 tokens18) external returns (uint256 usdcOut);
}

contract NASASAGateway {
    // --- External deps ---
    IUSDC public immutable USDC;
    IERC20 public immutable BRICS;
    IRedemptionClaim public redemptionClaim;
    IRedemptionQueue public redemptionQueue;
    INAVOracle public navOracle;
    IInstantLaneLike public instantLane;

    // --- Constants / config ---
    uint256 public constant QUOTE_STALE_SECONDS = 5 minutes; // for strike inputs if needed
    // Config key for settlement window (seconds). If unset in registry, fallback to 5 days.
    bytes32 public constant CFG_SETTLE_WINDOW_SEC = keccak256("gateway.settleWindowSec");
    IConfigRegistryLike private immutable _cfg; // optional, may be address(0)

    // --- Events ---
    event MonthEndStrike(uint256 indexed ts, uint256[] claimIds, uint256 navRay);
    event ClaimSettledPayout(uint256 indexed claimId, address indexed owner, uint256 usdcPaid);
    event InstantLaneSet(address indexed lane);

    constructor(
        IUSDC _usdc,
        IERC20 _brics,
        IRedemptionClaim _redemptionClaim,
        IRedemptionQueue _queue,
        INAVOracle _nav,
        IConfigRegistryLike cfg_
    ) {
        USDC = _usdc;
        BRICS = _brics;
        redemptionClaim = _redemptionClaim;
        redemptionQueue = _queue;
        navOracle = _nav;
        _cfg = cfg_;
    }

    // --------------------------
    // Instant lane management
    // --------------------------
    function setInstantLane(address lane) external {
        // TODO: Add proper access control - for now, anyone can set
        instantLane = IInstantLaneLike(lane);
        emit InstantLaneSet(lane);
    }

    function canInstantRedeem(address member, uint256 tokens18) external view returns (bool ok, uint256 capUSDC, uint256 usedUSDC, uint256 needUSDC) {
        if (address(instantLane) == address(0)) revert("GW/INSTANT_UNSET");
        return instantLane.canInstantRedeem(member, tokens18);
    }

    function redeemInstant(uint256 tokens18) external returns (uint256 usdcOut) {
        if (address(instantLane) == address(0)) revert("GW/INSTANT_UNSET");
        
        // Transfer tokens from user to instant lane
        require(BRICS.transferFrom(msg.sender, address(instantLane), tokens18), "GW/TRANSFER_FAIL");
        
        return instantLane.instantRedeemFor(msg.sender, tokens18);
    }

    // --------------------------
    // Primary lane queueing
    // --------------------------
    function queueRedemptionPrimary(uint256 bricsAmount) external returns (uint256 claimId) {
        require(bricsAmount > 0, "GW/AMOUNT_ZERO");
        // member gating assumed checked elsewhere
        claimId = redemptionQueue.enqueue(msg.sender, bricsAmount, 1);
        // Mint ERC‑1155/claim token to caller for tracking/secondary transfer if supported
        redemptionClaim.mint(msg.sender, bricsAmount);
    }

    // --------------------------
    // Month-end strike
    // --------------------------
    /// @notice Strike queued primary claims at month end using latest NAV
    /// @dev    No payout occurs here; we only compute usdcOwed and move to Struck.
    function processMonthEndStrike(uint256[] calldata claimIds) external {
        uint256 navRay = navOracle.latestNAVRay();
        require(navRay > 0, "GW/BAD_NAV");
        // compute usdcOwed and mark Struck inside queue
        redemptionQueue.processStrike(claimIds, navRay);
        emit MonthEndStrike(block.timestamp, claimIds, navRay);
    }

    // --------------------------
    // T+5 Settlement
    // --------------------------
    /// @notice User-initiated settlement within T+5 after strike; pays USDC then finalizes claim
    function settleClaim(uint256 claimId) external {
        // use queue helper for a single SLOAD path in tests/integration
        (
            uint256 tokens,
            uint256 usdcOwed,
            uint8 statusU8,
            uint64 struckAt,
            address owner,
            /*lane*/
        ) = redemptionQueue.claims(claimId);

        require(statusU8 == 1, "GW/NOT_STRUCK"); // 1 = Struck
        require(owner == msg.sender, "GW/NOT_OWNER");
        uint256 window = _settlementWindowSec();
        require(block.timestamp <= struckAt + window, "GW/WINDOW_EXPIRED");

        // Transfer USDC payout
        require(USDC.transfer(msg.sender, usdcOwed), "GW/USDC_TRANSFER_FAIL");

        // Burn the ERC‑1155/claim token (if used) and mark queue as Settled
        redemptionClaim.burn(claimId);
        redemptionQueue.markSettled(claimId, usdcOwed);
        emit ClaimSettledPayout(claimId, msg.sender, usdcOwed);
    }

    /// @dev resolve settlement window with safe fallback (5 days)
    function _settlementWindowSec() internal view returns (uint256) {
        if (address(_cfg) == address(0)) return 5 days;
        // try/catch to be defensive if registry reverts
        try _cfg.getUint(CFG_SETTLE_WINDOW_SEC) returns (uint256 v) {
            return v == 0 ? uint256(5 days) : v;
        } catch {
            return uint256(5 days);
        }
    }
}
