// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IssuanceControllerV3
 * @dev Core mint/redeem logic with emergency controls and per-sovereign soft-cap damping
 * @spec §3 Per-Sovereign Soft-Cap Damping
 * @spec §5 Oracle Signer & Degradation
 * @trace SPEC §3: Effective capacity calculation, linear damping slope, emergency pause
 * @trace SPEC §5: EIP-712 verification (TODO), DEGRADED mode handling (TODO)
 */

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BRICSToken.sol";
import "./ConfigRegistry.sol";
import "./TrancheManagerV2.sol";
import "./RedemptionClaim.sol";
import "./Treasury.sol";
import "./PreTrancheBuffer.sol";

interface INAVOracleLike {
    function navRay() external view returns (uint256);
    function lastTs() external view returns (uint256);
    function degradationMode() external view returns (bool);
}

contract IssuanceControllerV3 is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPS_ROLE = keccak256("OPS");
    bytes32 public constant GOV_ROLE = keccak256("GOV");
    bytes32 public constant ECC_ROLE = keccak256("ECC");

    BRICSToken       public token;
    TrancheManagerV2 public tm;
    ConfigRegistry   public cfg;
    INAVOracleLike   public oracle;
    IERC20           public usdc;
    Treasury         public treasury;
    RedemptionClaim  public claims;
    PreTrancheBuffer public preBuffer;

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

    constructor(
        address gov,
        BRICSToken _token,
        TrancheManagerV2 _tm,
        ConfigRegistry _cfg,
        INAVOracleLike _oracle,
        IERC20 _usdc,
        Treasury _treasury,
        RedemptionClaim _claims,
        PreTrancheBuffer _preBuffer
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(OPS_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
        token = _token;
        tm = _tm;
        cfg = _cfg;
        oracle = _oracle;
        usdc = _usdc;
        treasury = _treasury;
        claims = _claims;
        preBuffer = _preBuffer;
        nextStrike = _endOfMonth(block.timestamp);
    }

    function priceRay() public view returns (uint256) { return oracle.navRay(); }
    function nextStrikeTs() external view returns (uint256) { return nextStrike; }

    function _endOfMonth(uint256 ts) internal pure returns (uint256) {
        return ts + 30 days; // simplified; production: robust calendar
    }

    // SPEC §3: Per-sovereign soft-cap damping calculation
    function _calculateEffectiveCapacity(bytes32 sovereignCode, uint256 requestedAmount) internal view returns (uint256 effectiveCap, bool canIssue) {
        (uint256 baseEffectiveCap, bool isEnabled) = cfg.getEffectiveCapacity(sovereignCode);
        if (!isEnabled) return (0, false);
        
        uint256 currentUtilization = sovereignUtilization[sovereignCode];
        uint256 softCap = sovereignSoftCap[sovereignCode];
        uint256 hardCap = sovereignHardCap[sovereignCode];
        
        // If utilization is below soft cap, full capacity available
        if (currentUtilization <= softCap) {
            effectiveCap = baseEffectiveCap;
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
        
        effectiveCap = baseEffectiveCap * (10000 - dampingFactor) / 10000;
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

        // Apply issuance rate limit
        uint256 nav = oracle.navRay();
        if (nav == 0) return false;
        uint256 tokensOut = (usdcAmt * 1e27) / nav;
        uint256 adjustedTokensOut = (tokensOut * params.maxIssuanceRateBps) / 10000;
        
        if (totalIssued + adjustedTokensOut > tm.superSeniorCap()) return false;

        // Enhanced buffer checks (IRB + Pre-Tranche Buffer)
        uint256 outstanding = totalIssued;
        uint256 minIRB = (outstanding * params.instantBufferBps) / 10_000;
        if (treasury.balance() < minIRB) return false;

        return true;
    }

    function mintFor(address to, uint256 usdcAmt, uint256 tailCorrPpm, uint256 sovUtilBps, bytes32 sovereignCode)
        external
        onlyRole(OPS_ROLE)
        nonReentrant
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

        uint256 nav = oracle.navRay();
        require(nav > 0, "nav=0");

        out = (usdcAmt * 1e27) / nav;
        
        // Apply emergency issuance rate limit
        if (params.maxIssuanceRateBps < 10000) {
            out = (out * params.maxIssuanceRateBps) / 10000;
        }
        
        if (totalIssued + out > tm.superSeniorCap()) revert CapExceeded();

        // Enhanced buffer check
        uint256 outstanding = totalIssued;
        uint256 minIRB = (outstanding * params.instantBufferBps) / 10_000;
        if (treasury.balance() < minIRB) revert IRBTooLow();

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

        usdc.safeTransferFrom(msg.sender, address(treasury), usdcAmt);
        token.mint(to, out);

        totalIssued += out;
        dailyIssuedBy[msg.sender] += out;
        emit Minted(to, usdcAmt, out);
    }

    function requestRedeemOnBehalf(address user, uint256 amt) external nonReentrant {
        // Dynamic cooldown: extend in higher emergency levels
        uint8 level = uint8(cfg.emergencyLevel());
        uint256 cooldown = redeemCooldown;
        if (level == 2) cooldown = redeemCooldown * 2; // ORANGE
        if (level == 3) cooldown = redeemCooldown * 4; // RED
        if (block.timestamp - lastRedeemReq[user] < cooldown) revert CooldownActive();
        lastRedeemReq[user] = block.timestamp;
        
        // Check if instant redemption is possible via Pre-Tranche Buffer
        uint256 instantCapacity = preBuffer.availableInstantCapacity(user);
        if (amt <= instantCapacity) {
            // Process instant redemption
            // Effects before external interaction for safety
            token.burn(user, amt);
            totalIssued -= amt;
            preBuffer.instantRedeem(user, amt);
            emit InstantRedeemProcessed(user, amt, "PreTrancheBuffer");
            return;
        }
        
        // Fall back to monthly queue
        pending[user] += amt;
        emit RedeemRequested(user, amt);
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
    
    function setDampingSlope(uint256 newSlope) external onlyRole(GOV_ROLE) {
        require(newSlope <= 10000, "slope > 100%");
        dampingSlopeK = newSlope;
        emit DampingSlopeSet(newSlope);
    }

    function strikeRedemption() external onlyRole(OPS_ROLE) {
        uint256 nav = oracle.navRay();
        require(nav > 0, "nav");
        emit Strike(block.timestamp, nav);
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
