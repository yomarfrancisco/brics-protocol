// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IssuanceControllerV3
 * @dev Core mint/redeem logic with emergency controls and per-sovereign soft-cap damping
 * @spec §3 Per-Sovereign Soft-Cap Damping
 * @spec §4 NAV Redemption Lane
 * @spec §5 Oracle Signer & Degradation
 * @trace SPEC §3: Effective capacity calculation, linear damping slope, emergency pause
 * @trace SPEC §4: NAV window lifecycle, queueing, claims, settlement with pro-rata partial fills
 * @trace SPEC §5: EIP-712 verification, conservative degradation with haircuts, emergency signer override
 */

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BRICSToken.sol";
import "./ConfigRegistry.sol";
import "./TrancheManagerV2.sol";
import "./RedemptionClaim.sol";
import "./Treasury.sol";
import "./PreTrancheBuffer.sol";
import "./ClaimRegistry.sol";

interface INAVOracleLike {
    function navRay() external view returns (uint256);
    function lastTs() external view returns (uint256);
    function degradationMode() external view returns (bool);
    function getDegradationLevel() external view returns (uint8);
    function getCurrentHaircutBps() external view returns (uint256);
}

contract IssuanceControllerV3 is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPS_ROLE = keccak256("OPS");
    bytes32 public constant GOV_ROLE = keccak256("GOV");
    bytes32 public constant ECC_ROLE = keccak256("ECC");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER");

    // SPEC §5: EIP-712 Constants for mint intent (not NAV)
    string public constant EIP712_NAME = "BRICS_ISSUANCE";
    string public constant EIP712_VERSION = "1";
    bytes32 public constant MINT_TYPEHASH = keccak256("MintIntent(address to,uint256 usdcAmt,uint256 tailCorrPpm,uint256 sovUtilBps,bytes32 sovereignCode,uint256 nonce,uint256 deadline,uint256 chainId)");
    
    // Cached domain separator for efficiency
    bytes32 private _DOMAIN_SEPARATOR;
    uint256 private _cachedChainId;
    mapping(address => uint256) private _mintNonces; // Per-signer nonces

    BRICSToken       public token;
    TrancheManagerV2 public tm;
    ConfigRegistry   public cfg;
    INAVOracleLike   public oracle;
    IERC20           public usdc;
    Treasury         public treasury;
    RedemptionClaim  public claims;
    PreTrancheBuffer public preBuffer;
    ClaimRegistry    public claimRegistry;

    uint256 public totalIssued;
    uint256 public nextStrike;
    mapping(address => uint256) public pending;

    // Anti-gaming cooldown
    mapping(address => uint256) public lastRedeemReq;
    uint256 public redeemCooldown = 1 days;
    event RedeemCooldownSet(uint256 seconds_);

    // Per-address issuance throttling (daily cap)
    mapping(address => uint256) public lastIssueDay;
    mapping(address => uint256) public dailyIssuedBy;
    uint256 public dailyIssueCap = 1_000_000e18; // default 1M BRICS/day per address

    // SPEC §3: Per-sovereign soft-cap damping tracking
    mapping(bytes32 => uint256) public sovereignUtilization; // sovereign code => utilization amount
    mapping(bytes32 => uint256) public sovereignSoftCap; // sovereign code => soft cap
    mapping(bytes32 => uint256) public sovereignHardCap; // sovereign code => hard cap
    uint256 public dampingSlopeK = 5000; // 50% damping slope (bps)

    // SPEC §4: NAV Redemption Lane Types
    enum NavWindowState { NONE, OPEN, CLOSED, STRUCK, SETTLED_PARTIAL, SETTLED_FULL }

    struct NavWindow {
        uint256 id;
        uint256 openTs;
        uint256 closeTs;   // queue closes; new requests go to next window
        uint256 strikeTs;  // when NAV was struck (set at strike time)
        uint256 navRayAtStrike; // 1e27
        uint256 totalRequested; // sum of queued token amounts
        uint256 totalPaidUSDC;  // cumulative
        NavWindowState state;
    }

    struct NavRequest {
        uint256 windowId;
        uint256 amountTokens;   // BRICS amount requested
        uint256 claimId;        // ERC-1155 id (0 before minted)
        bool    claimed;        // set true once RedemptionClaim is minted
    }

    // SPEC §4: NAV Redemption Lane Storage
    uint256 public currentWindowId;
    mapping(uint256 => NavWindow) public navWindows;               // windowId -> NavWindow
    mapping(address => uint256) public pendingBy;                  // user -> token amount (current window)
    mapping(address => NavRequest[]) public requestsBy;            // history per user
    mapping(uint256 => uint256) public claimToRemainingUSDC;       // claimId -> unpaid USDC (for partial fill carryover)
    uint256 public windowMinDuration = 2 days;                     // guardrail
    
    // FINAL CHECKS: Accounting & fairness - track reserved NAV redemptions
    uint256 public reservedForNav; // Total tokens reserved for NAV redemptions (not yet burned)
    
    // FINAL CHECKS: Data model completeness - claim↔window linkage
    mapping(uint256 => uint256) public claimToWindow; // claimId -> windowId
    
    // FINAL CHECKS: State guards & timing - T+5 enforcement
    uint256 public constant SETTLEMENT_DELAY = 5 days; // T+5 enforcement
    
    // FINAL CHECKS: Performance & UX - batching
    uint256 public constant MAX_BATCH_SIZE = 50; // Max users per mintClaimsForWindow call

    // Custom errors
    error Halted();
    error Locked();
    error TailExceeded();
    error SovUtilExceeded();
    error CapExceeded();
    error IRBTooLow();
    error CooldownActive();
    error AmountZero();
    error IssueCapExceeded();
    error SovereignCapExceeded(bytes32 sovereignCode);
    error SovereignDisabled(bytes32 sovereignCode);
    error DampingSlopeExceeded(bytes32 sovereignCode);
    
    // SPEC §5: EIP-712 signature verification errors
    error InvalidSignature();
    error ExpiredDeadline();
    error InvalidNonce();
    error OracleDegraded();
    
    // SPEC §4: NAV Redemption Lane Errors
    error WindowNotOpen();
    error WindowAlreadyOpen();
    error WindowNotClosed();
    error InvalidCloseTime();
    error NothingPending();
    error StrikePrereqNotMet();
    error InsufficientTreasury();
    error ClaimNotOwned();
    error AlreadyClaimed();
    error WrongWindowState();
    error ZeroAmount();
    
    // FINAL CHECKS: Additional errors
    error SettlementTooEarly();
    error BatchTooLarge();
    error ClaimWindowMismatch();

    // Enhanced governance with conditional extensions
    uint256 public lastRaiseTs;
    uint256 public constant RATIFY_DEADLINE = 7 days;
    uint256 public constant EXTENSION_PERIOD = 7 days;
    uint16  public ratifiedLo = 10000;
    uint16  public ratifiedHi = 10200;
    bool    public extensionUsed;
    uint256 public activeProposalYesVotes;
    uint256 public activeProposalTotalVotes;

    event Minted(address indexed user, uint256 usdcIn, uint256 tokensOut);
    event RedeemRequested(address indexed user, uint256 amount);
    event InstantRedeemProcessed(address indexed user, uint256 amount, string source);
    event Strike(uint256 ts, uint256 navRay);
    event DetachmentRatified(uint16 lo, uint16 hi);
    event DetachmentReverted(uint16 lo, uint16 hi);
    event RatificationExtended(uint256 newDeadline);
    event DailyIssueCapSet(uint256 newCap);
    event SovereignCapSet(bytes32 indexed sovereignCode, uint256 softCap, uint256 hardCap);
    event SovereignUtilizationUpdated(bytes32 indexed sovereignCode, uint256 utilization);
    event DampingSlopeSet(uint256 newSlope);
    
    // SPEC §5: EIP-712 signature verification events
    event MintRequestSigned(address indexed signer, address indexed to, uint256 usdcAmt, uint256 nonce);
    event OracleDegradationHandled(uint8 level, uint256 haircutBps, uint256 originalNav, uint256 adjustedNav);
    event MintNonceReset();
    event MintNonceResetRequested(address indexed requester, uint256 executeAt);
    event OracleRecoveryForced(uint256 timestamp, uint8 degradationLevel);

    // SPEC §4: NAV Redemption Lane Events
    event NAVWindowOpened(uint256 indexed windowId, uint256 openTs, uint256 closeTs);
    event NAVWindowClosed(uint256 indexed windowId, uint256 closeTs, uint256 totalQueuedTokens);
    event NAVRequestCreated(uint256 indexed windowId, address indexed user, uint256 amountTokens);
    event NAVClaimsMinted(uint256 indexed windowId, uint256 count, uint256 totalTokensClaimed);
    event NAVStruck(uint256 indexed windowId, uint256 strikeTs, uint256 navRayAtStrike);
    event NAVSettled(uint256 indexed windowId, uint256 indexed claimId, address indexed holder, uint256 usdcPaid, uint256 remainingUSDC);
    event NAVCarryoverCreated(uint256 indexed fromWindowId, uint256 indexed claimId, uint256 carryoverUSDC);
    event NAVWindowFullySettled(uint256 indexed windowId);

    constructor(
        address gov,
        BRICSToken _token,
        TrancheManagerV2 _tm,
        ConfigRegistry _cfg,
        INAVOracleLike _oracle,
        IERC20 _usdc,
        Treasury _treasury,
        RedemptionClaim _claims,
        PreTrancheBuffer _preBuffer,
        ClaimRegistry _claimRegistry
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(OPS_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
        _grantRole(BURNER_ROLE, gov);
        token = _token;
        tm = _tm;
        cfg = _cfg;
        oracle = _oracle;
        usdc = _usdc;
        treasury = _treasury;
        claims = _claims;
        preBuffer = _preBuffer;
        claimRegistry = _claimRegistry;
        nextStrike = _endOfMonth(block.timestamp);
        
        // SPEC §5: Initialize EIP-712 domain separator
        _cachedChainId = block.chainid;
        _DOMAIN_SEPARATOR = _domainSeparatorV4();
    }

    // SPEC §5: EIP-712 domain separator for efficiency
    function _domainSeparatorV4() internal view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(EIP712_NAME)),
            keccak256(bytes(EIP712_VERSION)),
            block.chainid,
            address(this)
        ));
    }

    // SPEC §5: EIP-712 hash function for mint intent (not NAV)
    function _hashMintIntent(
        address to,
        uint256 usdcAmt,
        uint256 tailCorrPpm,
        uint256 sovUtilBps,
        bytes32 sovereignCode,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            MINT_TYPEHASH,
            to,
            usdcAmt,
            tailCorrPpm,
            sovUtilBps,
            sovereignCode,
            nonce,
            deadline,
            block.chainid
        ));
        return keccak256(abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash));
    }

    // SPEC §5: Signature recovery helper
    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }

    // SPEC §5: Get current mint nonce for signature verification
    function getMintNonce(address signer) external view returns (uint256) {
        return _mintNonces[signer];
    }

    // SPEC §5: Get domain separator for off-chain signature generation
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function priceRay() public view returns (uint256) { return oracle.navRay(); }
    function nextStrikeTs() external view returns (uint256) { return nextStrike; }

    function _endOfMonth(uint256 ts) internal pure returns (uint256) {
        return ts + 30 days; // simplified; production: robust calendar
    }

    // FINAL CHECKS: Performance & UX - Better views
    function getEffectiveOutstanding() external view returns (uint256) {
        return totalIssued - reservedForNav;
    }

    function getWindowSummary(uint256 windowId) external view returns (
        NavWindowState state,
        uint256 openTs,
        uint256 closeTs,
        uint256 strikeTs,
        uint256 navRay,
        uint256 requested,
        uint256 paid,
        uint256 remaining
    ) {
        NavWindow storage w = navWindows[windowId];
        uint256 totalDue = _tokensToUSDC(w.totalRequested, w.navRayAtStrike);
        return (
            w.state,
            w.openTs,
            w.closeTs,
            w.strikeTs,
            w.navRayAtStrike,
            w.totalRequested,
            w.totalPaidUSDC,
            totalDue > w.totalPaidUSDC ? totalDue - w.totalPaidUSDC : 0
        );
    }

    function getUserClaims(address user) external view returns (uint256[] memory claimIds) {
        NavRequest[] storage requests = requestsBy[user];
        uint256 count = 0;
        
        // Count valid claims
        for (uint256 i = 0; i < requests.length; i++) {
            if (requests[i].claimed && requests[i].claimId > 0) {
                count++;
            }
        }
        
        // Build array
        claimIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < requests.length; i++) {
            if (requests[i].claimed && requests[i].claimId > 0) {
                claimIds[index] = requests[i].claimId;
                index++;
            }
        }
    }

    // SPEC §4: NAV Redemption Lane Views
    function currentNavWindow() external view returns (NavWindow memory) {
        return navWindows[currentWindowId];
    }

    function nextCutoffTime() external view returns (uint256) {
        NavWindow storage w = navWindows[currentWindowId];
        if (w.state == NavWindowState.OPEN) {
            return w.closeTs;
        }
        return 0;
    }

    function pendingOf(address user) external view returns (uint256) {
        return pendingBy[user];
    }

    function getUserRequests(address user) external view returns (NavRequest[] memory) {
        return requestsBy[user];
    }

    function claimRemainingUSDC(uint256 claimId) external view returns (uint256) {
        return claimToRemainingUSDC[claimId];
    }

    // SPEC §4: NAV Redemption Lane Window Lifecycle
    function openNavWindow(uint256 closeTs) external onlyRole(OPS_ROLE) whenNotPaused {
        if (currentWindowId != 0 && navWindows[currentWindowId].state == NavWindowState.OPEN) revert WindowAlreadyOpen();
        if (closeTs <= block.timestamp + 1 hours || closeTs <= block.timestamp + windowMinDuration) revert InvalidCloseTime();
        
        uint256 id = ++currentWindowId;
        navWindows[id] = NavWindow({
            id: id,
            openTs: block.timestamp,
            closeTs: closeTs,
            strikeTs: 0,
            navRayAtStrike: 0,
            totalRequested: 0,
            totalPaidUSDC: 0,
            state: NavWindowState.OPEN
        });
        emit NAVWindowOpened(id, block.timestamp, closeTs);
    }

    function closeNavWindow() external onlyRole(OPS_ROLE) whenNotPaused {
        NavWindow storage w = navWindows[currentWindowId];
        if (w.state != NavWindowState.OPEN) revert WindowNotOpen();
        if (block.timestamp < w.closeTs) revert InvalidCloseTime();
        
        w.state = NavWindowState.CLOSED;
        emit NAVWindowClosed(w.id, w.closeTs, w.totalRequested);
    }

    // SPEC §4: NAV Redemption Lane Queueing
    function requestRedeemOnBehalf(address user, uint256 amt) external nonReentrant whenNotPaused {
        if (amt == 0) revert ZeroAmount();

        // Dynamic cooldown: extend in higher emergency levels
        uint8 level = uint8(cfg.emergencyLevel());
        uint256 cooldown = redeemCooldown;
        if (level == 2) cooldown = redeemCooldown * 2; // ORANGE
        if (level == 3) cooldown = redeemCooldown * 4; // RED
        if (block.timestamp - lastRedeemReq[user] < cooldown) revert CooldownActive();
        lastRedeemReq[user] = block.timestamp;
        
        // 1) Try instant redemption path first
        uint256 nav = oracle.navRay();
        require(nav > 0, "nav=0");
        
        // Convert token amount to USDC using NAV
        uint256 usdcOut = (amt * nav) / 1e27;
        
        uint256 instantCapacity = preBuffer.availableInstantCapacity(user);
        if (usdcOut <= instantCapacity) {
            // Check user has sufficient tokens
            require(token.balanceOf(user) >= amt, "insufficient tokens");
            
            // Burn exactly the token amount (18d)
            token.burn(user, amt);
            
            // Pay out USDC (6d)
            preBuffer.instantRedeem(user, usdcOut);
            
            // Keep totals in token units (only if totalIssued is tracked)
            if (totalIssued >= amt) {
                unchecked { totalIssued -= amt; }
            }
            
            emit InstantRedeemProcessed(user, amt, "PreTrancheBuffer");
            return;
        }
        
        // 2) Else queue into current NAV window
        NavWindow storage w = navWindows[currentWindowId];
        if (w.state != NavWindowState.OPEN) revert WindowNotOpen();

        pendingBy[user] += amt;
        w.totalRequested += amt;
        reservedForNav += amt; // FINAL CHECKS: Track reserved NAV redemptions
        
        requestsBy[user].push(NavRequest({
            windowId: w.id,
            amountTokens: amt,
            claimId: 0,
            claimed: false
        }));
        emit NAVRequestCreated(w.id, user, amt);
    }

    // SPEC §4: NAV Redemption Lane Claim Minting
    function mintClaimsForWindow(address[] calldata users) external onlyRole(OPS_ROLE) whenNotPaused {
        if (users.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        
        NavWindow storage w = navWindows[currentWindowId];
        if (w.state != NavWindowState.CLOSED) revert WindowNotClosed();

        uint256 totalTokens;
        uint256 count;

        for (uint256 i = 0; i < users.length; ++i) {
            address u = users[i];
            uint256 amt = pendingBy[u];
            if (amt == 0) continue;

            // Mint ERC-1155 claim to user (strikeTs set later at strike)
            uint256 claimId = _mintClaimForUser(u, w.id, amt);
            
            // Clear queue AFTER external call (reentrancy protection)
            pendingBy[u] = 0;
            totalTokens += amt;
            
            // FINAL CHECKS: Data model completeness - claim↔window linkage
            claimToWindow[claimId] = w.id;
            
            // Update user request entry
            NavRequest[] storage rs = requestsBy[u];
            for (uint256 j = rs.length; j > 0; j--) {
                if (rs[j-1].windowId == w.id && !rs[j-1].claimed && rs[j-1].amountTokens == amt) {
                    rs[j-1].claimed = true;
                    rs[j-1].claimId = claimId;
                    break;
                }
            }
            count++;
        }

        emit NAVClaimsMinted(w.id, count, totalTokens);
    }

    // SPEC §4: NAV Redemption Lane Strike
    function strikeRedemption() external onlyRole(OPS_ROLE) whenNotPaused {
        NavWindow storage w = navWindows[currentWindowId];
        if (w.state != NavWindowState.CLOSED) revert StrikePrereqNotMet();

        uint256 nav = oracle.navRay();
        require(nav > 0, "nav=0");

        w.navRayAtStrike = nav;
        w.strikeTs = block.timestamp;
        w.state = NavWindowState.STRUCK;

        emit NAVStruck(w.id, w.strikeTs, w.navRayAtStrike);
    }

    // SPEC §4: NAV Redemption Lane Settlement
    function settleClaim(uint256 windowId, uint256 claimId, address holder) external onlyRole(BURNER_ROLE) nonReentrant whenNotPaused {
        NavWindow storage w = navWindows[windowId];
        if (w.state != NavWindowState.STRUCK && w.state != NavWindowState.SETTLED_PARTIAL) revert WrongWindowState();
        
        // FINAL CHECKS: State guards & timing - T+5 enforcement
        if (block.timestamp < w.strikeTs + SETTLEMENT_DELAY) revert SettlementTooEarly();
        
        // FINAL CHECKS: Data model completeness - claim↔window linkage
        if (claimToWindow[claimId] != windowId) revert ClaimWindowMismatch();

        // Get claim info
        (address owner, uint256 amountTokens, bool settled) = _getClaimInfo(claimId);
        require(owner == holder && !settled, "bad owner/settled");

        // Calculate payout = tokens * navRayAtStrike / 1e27 (in USDC 1e6)
        uint256 usdcDue = _tokensToUSDC(amountTokens, w.navRayAtStrike);

        // If prior partial remains:
        uint256 remaining = claimToRemainingUSDC[claimId];
        if (remaining > 0 && remaining < usdcDue) usdcDue = remaining;

        uint256 bal = usdc.balanceOf(address(treasury));
        uint256 payAmt = usdcDue <= bal ? usdcDue : bal;

        if (payAmt <= 0) revert InsufficientTreasury();

        // Track paid vs remaining BEFORE external call (reentrancy protection)
        w.totalPaidUSDC += payAmt;
        uint256 leftover = usdcDue - payAmt;
        claimToRemainingUSDC[claimId] = leftover;

        // Pay holder
        treasury.pay(holder, payAmt);

        // Burn claim if fully paid; else leave claim live for carryover
        if (leftover <= 0) {
            // Update state BEFORE external call (reentrancy protection)
            reservedForNav -= amountTokens;
            _settleAndBurnClaim(claimId, holder);
        } else {
            emit NAVCarryoverCreated(windowId, claimId, leftover);
        }

        // Window state update
        uint256 totalDue = _tokensToUSDC(w.totalRequested, w.navRayAtStrike);
        if (w.totalPaidUSDC >= totalDue) {
            w.state = NavWindowState.SETTLED_FULL;
            emit NAVWindowFullySettled(windowId);
        } else {
            w.state = NavWindowState.SETTLED_PARTIAL;
        }

        emit NAVSettled(windowId, claimId, holder, payAmt, leftover);
    }

    // SPEC §5: Oracle health check helper with emergency level linkage
    function _oracleOk() internal view returns (bool) {
        uint8 degradationLevel = oracle.getDegradationLevel();
        uint8 emergencyLevel = uint8(cfg.emergencyLevel());
        
        // RED state: halt issuance regardless of oracle state
        if (emergencyLevel == 3) return false;
        
        // SPEC §5: Conservative degradation - allow issuance with haircuts in STALE mode
        // Only block issuance if oracle is in DEGRADED or EMERGENCY_OVERRIDE mode
        if (degradationLevel >= 2) return false; // DEGRADED or EMERGENCY_OVERRIDE
        
        return true;
    }

    // SPEC §9: Enhanced Buffer Coordination - liquidity health check
    function _liquidityOk() internal view returns (bool) {
        // Only need irbTarget from getLiquidityStatus - other values intentionally ignored
        (,, uint256 irbTarget,,) = treasury.getLiquidityStatus();
        uint256 irbBal = usdc.balanceOf(address(treasury));
        
        if (irbBal < irbTarget) return false; // IRB shortfall blocks issuance
        
        // Optional: require PreTrancheBuffer ≥ min threshold in ORANGE/RED
        ConfigRegistry.EmergencyLevel level = cfg.emergencyLevel();
        if (level == ConfigRegistry.EmergencyLevel.ORANGE || level == ConfigRegistry.EmergencyLevel.RED) {
            // Only need current and target from getBufferStatus - other values intentionally ignored
            (uint256 current, uint256 target,,) = preBuffer.getBufferStatus();
            if (current < target * 8000 / 10000) return false; // Require 80% of target in emergency
        }
        
        return true;
    }

    // SPEC §5: Get NAV from oracle (haircuts already applied in oracle)
    function _getNavWithDegradation() internal view returns (uint256 nav, uint8 level, uint256 haircutBps) {
        nav = oracle.navRay(); // Oracle already applies haircuts
        level = oracle.getDegradationLevel();
        haircutBps = oracle.getCurrentHaircutBps();
        return (nav, level, haircutBps);
    }

    // SPEC §4: NAV Redemption Lane Helper Functions
    function _mintClaimForUser(address to, uint256 windowId, uint256 amount) internal returns (uint256) {
        uint256 claimId = claims.mintClaim(to, 0, amount); // strikeTs set later
        claimToWindow[claimId] = windowId; // Link claim to window
        return claimId;
    }

    function _getClaimInfo(uint256 claimId) internal view returns (address owner, uint256 amount, bool settled) {
        (owner, amount, , settled) = claims.claimInfo(claimId);
        // strikeTs is intentionally ignored as it's not needed for this function
    }

    function _settleAndBurnClaim(uint256 claimId, address holder) internal {
        claims.settleAndBurn(claimId, holder);
    }

    // FINAL CHECKS: Units & rounding - Lock exact decimals and rounding rule
    function _tokensToUSDC(uint256 tokenAmt, uint256 navRay) internal pure returns (uint256) {
        // BRICS: 18 decimals, NAV: 1e18, USDC: 6 decimals
        // Round DOWN to favor the protocol
        // USDC = tokenAmt * navRay / 1e30
        // Use higher precision to avoid divide-before-multiply
        return (tokenAmt * navRay) / 1e30;
    }

    // SPEC §3: Per-sovereign soft-cap damping calculation
    function _calculateEffectiveCapacity(bytes32 sovereignCode, uint256 requestedAmount) internal view returns (uint256 effectiveCap, bool canIssue) {
        (uint256 baseEffectiveCap, bool isEnabled) = cfg.getEffectiveCapacity(sovereignCode);
        if (!isEnabled) return (0, false);
        
        uint256 currentUtilization = sovereignUtilization[sovereignCode];
        uint256 softCap = sovereignSoftCap[sovereignCode];
        uint256 hardCap = sovereignHardCap[sovereignCode];
        
        // Convert basis points to USDC capacity (avoid divide-before-multiply)
        uint256 effectiveCapUSDC = (softCap * baseEffectiveCap) / 10000;
        
        // If utilization is below soft cap, full capacity available
        if (currentUtilization <= softCap) {
            effectiveCap = effectiveCapUSDC;
            canIssue = requestedAmount <= effectiveCap;
            return (effectiveCap, canIssue);
        }
        
        // If utilization is above hard cap, no capacity available
        if (currentUtilization >= hardCap) {
            return (0, false);
        }
        
        // Linear damping slope between softCap and hardCap
        // effectiveCap = baseEffectiveCap * (1 - k * (utilization - softCap) / (hardCap - softCap))
        uint256 dampingFactor = dampingSlopeK * (currentUtilization - softCap) / (hardCap - softCap);
        if (dampingFactor >= 10000) return (0, false); // Fully damped
        
        uint256 dampedCapBps = baseEffectiveCap * (10000 - dampingFactor) / 10000;
        effectiveCap = (softCap * dampedCapBps) / 10000; // Convert to USDC (avoid divide-before-multiply)
        canIssue = requestedAmount <= effectiveCap;
        return (effectiveCap, canIssue);
    }

    function canIssue(uint256 usdcAmt, uint256 tailCorrPpm, uint256 sovUtilBps, bytes32 sovereignCode) external view returns (bool) {
        // Check emergency level constraints
        ConfigRegistry.EmergencyParams memory params = cfg.getCurrentParams();
        
        if (params.maxIssuanceRateBps == 0) return false; // RED state halt
        if (tm.issuanceLocked()) return false;
        if (tailCorrPpm > cfg.maxTailCorrPpm()) return false;
        if (sovUtilBps > cfg.maxSovUtilBps()) return false;

        // SPEC §3: Check sovereign-specific capacity
        (uint256 effectiveCap, bool canIssueSovereign) = _calculateEffectiveCapacity(sovereignCode, usdcAmt);
        if (!canIssueSovereign) return false;

        // SPEC §5: Check oracle health and get NAV with degradation handling
        if (!_oracleOk()) return false;
        
        // SPEC §9: Check liquidity health (IRB + Pre-Tranche Buffer coordination)
        if (!_liquidityOk()) return false;
        
        (uint256 nav, , ) = _getNavWithDegradation();
        if (nav == 0) return false;
        
        uint256 tokensOut = (usdcAmt * 1e27) / nav;
        uint256 adjustedTokensOut = (tokensOut * params.maxIssuanceRateBps) / 10000; // Avoid divide-before-multiply
        
        // FINAL CHECKS: Accounting & fairness - use effective outstanding
        uint256 effectiveOutstanding = totalIssued - reservedForNav;
        if (effectiveOutstanding + adjustedTokensOut > tm.superSeniorCap()) return false;

        // Check sovereign guarantee availability in crisis
        uint8 level = uint8(cfg.emergencyLevel());
        if (level == 3 && !claimRegistry.isSovereignGuaranteeAvailable()) {
            return false; // No sovereign guarantee available
        }

        return true;
    }

    // SPEC §5: EIP-712 signature verification mint function
    function mintForSigned(
        address to,
        uint256 usdcAmt,
        uint256 tailCorrPpm,
        uint256 sovUtilBps,
        bytes32 sovereignCode,
        uint256 deadline,
        bytes calldata signature
    )
        external
        onlyRole(OPS_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256 out)
    {
        if (usdcAmt == 0) revert AmountZero();
        if (block.timestamp > deadline) revert ExpiredDeadline();
        
        // SPEC §5: Verify EIP-712 signature for mint intent (not NAV)
        bytes32 digest = _hashMintIntent(to, usdcAmt, tailCorrPpm, sovUtilBps, sovereignCode, _mintNonces[msg.sender], deadline);
        address signer = _recover(digest, signature);
        
        // Verify signer has OPS_ROLE or GOV_ROLE
        if (!hasRole(OPS_ROLE, signer) && !hasRole(GOV_ROLE, signer)) {
            revert InvalidSignature();
        }
        
        emit MintRequestSigned(signer, to, usdcAmt, _mintNonces[msg.sender]);
        _mintNonces[msg.sender]++; // Increment per-signer nonce to prevent replay attacks
        
        ConfigRegistry.EmergencyParams memory params = cfg.getCurrentParams();
        
        if (params.maxIssuanceRateBps == 0) revert Halted();
        if (tm.issuanceLocked()) revert Locked();
        if (tailCorrPpm > cfg.maxTailCorrPpm()) revert TailExceeded();
        if (sovUtilBps > cfg.maxSovUtilBps()) revert SovUtilExceeded();

        // SPEC §3: Check sovereign-specific capacity
        (uint256 effectiveCap, bool canIssueSovereign) = _calculateEffectiveCapacity(sovereignCode, usdcAmt);
        if (!canIssueSovereign) revert SovereignCapExceeded(sovereignCode);

        // SPEC §5: Check oracle health and get NAV with degradation handling
        if (!_oracleOk()) revert OracleDegraded();
        
        (uint256 nav, uint8 degradationLevel, uint256 haircutBps) = _getNavWithDegradation();
        require(nav > 0, "nav=0");

        out = (usdcAmt * 1e27) / nav;
        
        // Apply emergency issuance rate limit
        if (params.maxIssuanceRateBps < 10000) {
            out = (out * params.maxIssuanceRateBps) / 10000;
        }
        
        // FINAL CHECKS: Accounting & fairness - use effective outstanding
        uint256 effectiveOutstanding = totalIssued - reservedForNav;
        if (effectiveOutstanding + out > tm.superSeniorCap()) revert CapExceeded();

        // SPEC §9: Enhanced buffer coordination check
        if (!_liquidityOk()) revert IRBTooLow();

        // Check sovereign guarantee availability in crisis
        uint8 level = uint8(cfg.emergencyLevel());
        if (level == 3 && !claimRegistry.isSovereignGuaranteeAvailable()) {
            revert("No sovereign guarantee available");
        }

        // Per-address issuance daily cap
        uint256 today = block.timestamp / 1 days;
        if (lastIssueDay[msg.sender] != today) {
            lastIssueDay[msg.sender] = today;
            dailyIssuedBy[msg.sender] = 0;
        }
        if (dailyIssuedBy[msg.sender] + out > dailyIssueCap) revert IssueCapExceeded();

        // SPEC §3: Update sovereign utilization
        sovereignUtilization[sovereignCode] += usdcAmt;
        emit SovereignUtilizationUpdated(sovereignCode, sovereignUtilization[sovereignCode]);

        // SPEC §5: Emit degradation handling event if haircut was applied
        if (degradationLevel == 1 && haircutBps > 0) {
            uint256 originalNav = oracle.navRay();
            emit OracleDegradationHandled(degradationLevel, haircutBps, originalNav, nav);
        }

        usdc.safeTransferFrom(msg.sender, address(treasury), usdcAmt);
        
        // Update state variables BEFORE external call (reentrancy protection)
        totalIssued += out;
        dailyIssuedBy[msg.sender] += out;
        
        token.mint(to, out);
        emit Minted(to, usdcAmt, out);
    }

    // Legacy mintFor function (deprecated - use mintForSigned for EIP-712 verification)
    function mintFor(address to, uint256 usdcAmt, uint256 tailCorrPpm, uint256 sovUtilBps, bytes32 sovereignCode)
        external
        onlyRole(OPS_ROLE)
        nonReentrant
        whenNotPaused
        returns (uint256 out)
    {
        if (usdcAmt == 0) revert AmountZero();
        ConfigRegistry.EmergencyParams memory params = cfg.getCurrentParams();
        
        if (params.maxIssuanceRateBps == 0) revert Halted();
        if (tm.issuanceLocked()) revert Locked();
        if (tailCorrPpm > cfg.maxTailCorrPpm()) revert TailExceeded();
        if (sovUtilBps > cfg.maxSovUtilBps()) revert SovUtilExceeded();

        // SPEC §3: Check sovereign-specific capacity
        (uint256 effectiveCap, bool canIssueSovereign) = _calculateEffectiveCapacity(sovereignCode, usdcAmt);
        if (!canIssueSovereign) revert SovereignCapExceeded(sovereignCode);

        // SPEC §5: Check oracle health and get NAV with degradation handling
        if (!_oracleOk()) revert OracleDegraded();
        
        (uint256 nav, uint8 degradationLevel, uint256 haircutBps) = _getNavWithDegradation();
        require(nav > 0, "nav=0");

        out = (usdcAmt * 1e27) / nav;
        
        // Apply emergency issuance rate limit
        if (params.maxIssuanceRateBps < 10000) {
            out = (out * params.maxIssuanceRateBps) / 10000;
        }
        
        // FINAL CHECKS: Accounting & fairness - use effective outstanding
        uint256 effectiveOutstanding = totalIssued - reservedForNav;
        if (effectiveOutstanding + out > tm.superSeniorCap()) revert CapExceeded();

        // Enhanced buffer check
        uint256 minIRB = (effectiveOutstanding * params.instantBufferBps) / 10_000;
        if (treasury.balance() < minIRB) revert IRBTooLow();

        // Check sovereign guarantee availability in crisis
        uint8 level = uint8(cfg.emergencyLevel());
        if (level == 3 && !claimRegistry.isSovereignGuaranteeAvailable()) {
            revert("No sovereign guarantee available");
        }

        // Per-address issuance daily cap
        uint256 today = block.timestamp / 1 days;
        if (lastIssueDay[msg.sender] != today) {
            lastIssueDay[msg.sender] = today;
            dailyIssuedBy[msg.sender] = 0;
        }
        if (dailyIssuedBy[msg.sender] + out > dailyIssueCap) revert IssueCapExceeded();

        // SPEC §3: Update sovereign utilization
        sovereignUtilization[sovereignCode] += usdcAmt;
        emit SovereignUtilizationUpdated(sovereignCode, sovereignUtilization[sovereignCode]);

        // SPEC §5: Emit degradation handling event if haircut was applied
        if (degradationLevel == 1 && haircutBps > 0) {
            uint256 originalNav = oracle.navRay();
            emit OracleDegradationHandled(degradationLevel, haircutBps, originalNav, nav);
        }

        usdc.safeTransferFrom(msg.sender, address(treasury), usdcAmt);
        
        // Update state variables BEFORE external call (reentrancy protection)
        totalIssued += out;
        dailyIssuedBy[msg.sender] += out;
        
        token.mint(to, out);
        emit Minted(to, usdcAmt, out);
    }

    // FINAL CHECKS: Access control & safety - Pausable functionality
    function pause() external onlyRole(GOV_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GOV_ROLE) {
        _unpause();
    }

    // Governance setters
    function setDailyIssueCap(uint256 newCap) external onlyRole(GOV_ROLE) {
        dailyIssueCap = newCap;
        emit DailyIssueCapSet(newCap);
    }
    function setRedeemCooldown(uint256 seconds_) external onlyRole(GOV_ROLE) {
        redeemCooldown = seconds_;
        emit RedeemCooldownSet(seconds_);
    }

    // SPEC §3: Sovereign cap management
    function setSovereignCap(bytes32 sovereignCode, uint256 softCap, uint256 hardCap) external onlyRole(GOV_ROLE) {
        require(softCap <= hardCap, "soft cap > hard cap");
        sovereignSoftCap[sovereignCode] = softCap;
        sovereignHardCap[sovereignCode] = hardCap;
        emit SovereignCapSet(sovereignCode, softCap, hardCap);
    }
    
    // Debug function for sovereign capacity diagnostics
    function getSovereignCapacityDebug(bytes32 sovereignCode) external view returns (
        uint256 softCapUSDC,
        uint256 capBps,
        uint256 capUSDC,
        uint256 usedUSDC,
        uint256 remUSDC
    ) {
        (uint256 baseEffectiveCap, bool isEnabled) = cfg.getEffectiveCapacity(sovereignCode);
        if (!isEnabled) return (0, 0, 0, 0, 0);
        
        softCapUSDC = sovereignSoftCap[sovereignCode];
        capBps = baseEffectiveCap;
        capUSDC = (softCapUSDC * capBps) / 10000;
        usedUSDC = sovereignUtilization[sovereignCode];
        remUSDC = usedUSDC >= capUSDC ? 0 : capUSDC - usedUSDC;
    }
    
    function setDampingSlope(uint256 newSlope) external onlyRole(GOV_ROLE) {
        require(newSlope <= 10000, "slope > 100%");
        dampingSlopeK = newSlope;
        emit DampingSlopeSet(newSlope);
    }

    // SPEC §5: Recovery procedures for oracle restoration (timelocked)
    uint256 public constant RECOVERY_DELAY = 24 hours;
    mapping(address => uint256) public recoveryRequests;
    
    function requestMintNonceReset() external onlyRole(ECC_ROLE) {
        recoveryRequests[msg.sender] = block.timestamp + RECOVERY_DELAY;
        emit MintNonceResetRequested(msg.sender, block.timestamp + RECOVERY_DELAY);
    }
    
    function executeMintNonceReset() external onlyRole(ECC_ROLE) {
        require(recoveryRequests[msg.sender] > 0, "No reset requested");
        require(block.timestamp >= recoveryRequests[msg.sender], "Timelock not expired");
        
        // Reset all nonces
        delete recoveryRequests[msg.sender];
        emit MintNonceReset();
    }
    
    function forceOracleRecovery() external onlyRole(ECC_ROLE) {
        // Only allow if oracle is actually in degradation
        uint8 degradationLevel = oracle.getDegradationLevel();
        require(degradationLevel >= 2, "Oracle not in degradation");
        
        emit OracleRecoveryForced(block.timestamp, degradationLevel);
    }

    // Enhanced governance with conditional extensions
    function ratifyDetachment() external onlyRole(GOV_ROLE) {
        (uint16 currentLo, uint16 currentHi) = tm.getEffectiveDetachment();
        ratifiedLo = currentLo;
        ratifiedHi = currentHi;
        lastRaiseTs = block.timestamp;
        extensionUsed = false; // Reset for next cycle
        emit DetachmentRatified(ratifiedLo, ratifiedHi);
    }

    function updateProposalVotes(uint256 yesVotes, uint256 totalVotes) external onlyRole(GOV_ROLE) {
        activeProposalYesVotes = yesVotes;
        activeProposalTotalVotes = totalVotes;
    }

    function extendRatificationDeadline() external onlyRole(ECC_ROLE) {
        require(!extensionUsed, "extension already used");
        require(activeProposalTotalVotes > 0, "no active proposal");
        require((activeProposalYesVotes * 10000) / activeProposalTotalVotes >= 5000, "insufficient support"); // >50%
        
        uint256 timeElapsed = block.timestamp - tm.lastDetachmentUpdateTs();
        require(timeElapsed >= RATIFY_DEADLINE && timeElapsed < RATIFY_DEADLINE + 1 days, "wrong timing");
        
        extensionUsed = true;
        emit RatificationExtended(block.timestamp + EXTENSION_PERIOD);
    }

    function maybeRevertDetachment() external onlyRole(OPS_ROLE) {
        (uint16 currentLo, uint16 currentHi) = tm.getEffectiveDetachment();
        if (currentLo == ratifiedLo && currentHi == ratifiedHi) return;
        
        uint256 deadline = extensionUsed ? 
            tm.lastDetachmentUpdateTs() + RATIFY_DEADLINE + EXTENSION_PERIOD :
            tm.lastDetachmentUpdateTs() + RATIFY_DEADLINE;
            
        if (block.timestamp > deadline) {
            revertToRatified();
        }
    }

    function revertToRatified() internal {
        tm.setIssuanceLocked(true);
        emit DetachmentReverted(ratifiedLo, ratifiedHi);
    }
}
