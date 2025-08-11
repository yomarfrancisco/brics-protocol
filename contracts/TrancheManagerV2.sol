// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "./ConfigRegistry.sol";
import "./ClaimRegistry.sol";
import "./interfaces/IAdaptiveTranching.sol";

// Custom errors
error OnlyRaise();
error Cooldown();
error BadBand();
error NotTriggered();
error OracleStale();
error EmergencyLevelRequired();
error SovereignNotConfirmed();
error AlreadyExpanded();
error SupermajorityRequired();
error SoftCapExpiredNotSet();

interface IOracleFresh {
    function lastTs() external view returns (uint256);
    function degradationMode() external view returns (bool);
}

contract TrancheManagerV2 is AccessControl {
    bytes32 public constant GOV_ROLE = keccak256("GOV");
    bytes32 public constant ECC_ROLE = keccak256("ECC");

    // Detachment band (bps*100)
    uint16 public bricsLo = 10000;
    uint16 public bricsHi = 10200;
    uint256 public superSeniorCap;
    bool    public issuanceLocked;

    uint256 public lastDetachmentUpdateTs;
    uint256 public constant DETACHMENT_COOLDOWN = 24 hours;
    uint256 public constant ORACLE_STALE_TOL = 1 hours;

    address public immutable oracle;
    address public immutable config;
    bool    public triggersBreached;

    // 105% soft-cap expansion (RED only)
    bool public sovereignGuaranteeConfirmed;
    uint256 public supermajorityThreshold = 6700; // 67%
    uint256 public softCapExpiry;                 // <= 30 days
    uint256 public constant SOFT_CAP_MAX_WINDOW = 30 days;

    // Tier 2 expansion (106-108%) integration
    ClaimRegistry public claimRegistry;
    uint256 public constant TIER2_EXPANSION_DURATION = 14 days;
    uint256 public tier2Expiry;
    uint8 public expansionTier; // 0=none, 1=105%, 2=106-108%

    // Governance attestation
    uint256 public lastVoteYesBps;  // yes/total in bps
    uint256 public lastVoteTs;

    // Adaptive Tranching v0.1 storage (no economic impact)
    uint8 public tranchingMode; // 0=DISABLED, 1=DRY_RUN, 2=ENFORCED
    uint64 public sovereignUsageThresholdBps; // Default: 2000 (20%)
    uint64 public defaultsThresholdBps; // Configurable defaults threshold
    uint32 public correlationThresholdPpm; // Default: 650000 (65%)

    event CapAdjusted(uint256 cap);
    event IssuanceLocked(bool locked);
    event DetachmentRaised(uint16 lo, uint16 hi);
    event SoftCapExpanded(uint16 newHi, string reason, uint256 expiry);
    event SoftCapReverted(uint16 lo, uint16 hi, string reason);
    event SovereignGuaranteeConfirmed(bool confirmed);
    event TriggersBreachedSet(bool breached);
    event SupermajorityAttested(uint256 yesBps, uint256 ts);
    event Tier2Expansion(uint16 newHi, uint256 claimId, uint256 expiry);
    event Tier2Reverted(uint16 lo, uint16 hi, string reason);

    // Adaptive Tranching v0.1 events (no economic impact)
    event RiskSignalSubmitted(IAdaptiveTranching.RiskSignal signal, address indexed submitter);
    event TranchingModeChanged(uint8 mode, address indexed governor);
    event ThresholdsUpdated(uint64 sovereignUsageBps, uint64 defaultsBps, uint32 corrPpm);

    constructor(address gov, address oracle_, address config_) {
        require(oracle_ != address(0), "oracle cannot be zero address");
        require(config_ != address(0), "config cannot be zero address");
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
        oracle = oracle_;
        config = config_;
    }

    function setClaimRegistry(address _claimRegistry) external onlyRole(GOV_ROLE) {
        claimRegistry = ClaimRegistry(_claimRegistry);
    }

    function setTriggersBreached(bool breached) external {
        require(hasRole(ECC_ROLE, msg.sender) || hasRole(GOV_ROLE, msg.sender), "unauthorized");
        triggersBreached = breached;
        emit TriggersBreachedSet(breached);
    }

    function confirmSovereignGuarantee(bool confirmed) external onlyRole(GOV_ROLE) {
        sovereignGuaranteeConfirmed = confirmed;
        emit SovereignGuaranteeConfirmed(confirmed);
    }

    function adjustSuperSeniorCap(uint256 cap) external onlyRole(GOV_ROLE) {
        superSeniorCap = cap; 
        emit CapAdjusted(cap);
    }

    function setIssuanceLocked(bool locked) external {
        require(hasRole(ECC_ROLE, msg.sender) || hasRole(GOV_ROLE, msg.sender), "unauthorized");
        issuanceLocked = locked; 
        emit IssuanceLocked(locked);
    }

    // Governance attests support percentage (bps). Used before expanding to 105%.
    function attestSupermajority(uint256 yesBps) external {
        require(hasRole(ECC_ROLE, msg.sender) || hasRole(GOV_ROLE, msg.sender), "unauthorized");
        require(yesBps <= 10_000, "bad bps");
        lastVoteYesBps = yesBps;
        lastVoteTs = block.timestamp;
        emit SupermajorityAttested(yesBps, lastVoteTs);
    }

    function getEffectiveDetachment() external view returns (uint16 lo, uint16 hi) {
        uint8 level = uint8(ConfigRegistry(config).emergencyLevel());
        
        // Check for Tier 2 expansion (106-108%) first
        if (level == 3 && 
            expansionTier == 2 && 
            tier2Expiry != 0 && 
            block.timestamp <= tier2Expiry) {
            return (bricsLo, 10800); // 108%
        }
        
        // Check for Tier 1 expansion (105%)
        if (level == 3 && sovereignGuaranteeConfirmed) {
            if (softCapExpiry != 0 && block.timestamp <= softCapExpiry) {
                return (bricsLo, 10500);
            }
        }
        return (bricsLo, bricsHi);
    }

    function raiseBRICSDetachment(uint16 newLo, uint16 newHi) external {
        require(hasRole(ECC_ROLE, msg.sender) || hasRole(GOV_ROLE, msg.sender), "unauthorized");

        // Only raise
        if (!(newLo >= bricsLo && newHi >= bricsHi)) revert OnlyRaise();

        // Standard raise up to 103%
        if (!(newHi > newLo && newHi - newLo == 200 && newLo >= 10000 && newHi <= 10300)) {
            revert BadBand();
        }

        if (block.timestamp - lastDetachmentUpdateTs < DETACHMENT_COOLDOWN) revert Cooldown();
        if (!IOracleFresh(oracle).degradationMode()) {
            uint256 last = IOracleFresh(oracle).lastTs();
            if (last + ORACLE_STALE_TOL < block.timestamp) revert OracleStale();
        }
        if (!triggersBreached) revert NotTriggered();

        bricsLo = newLo;
        bricsHi = newHi;
        lastDetachmentUpdateTs = block.timestamp;
        emit DetachmentRaised(bricsLo, bricsHi);
    }

    function emergencyExpandToSoftCap() external onlyRole(ECC_ROLE) {
        uint8 level = uint8(ConfigRegistry(config).emergencyLevel());
        if (level != 3) revert EmergencyLevelRequired();
        if (!sovereignGuaranteeConfirmed) revert SovereignNotConfirmed();
        if (bricsHi >= 10500) revert AlreadyExpanded();
        if (lastVoteYesBps < supermajorityThreshold) revert SupermajorityRequired();

        bricsHi = 10500;
        lastDetachmentUpdateTs = block.timestamp;
        softCapExpiry = block.timestamp + SOFT_CAP_MAX_WINDOW;

        emit SoftCapExpanded(10500, "ECC emergency expansion", softCapExpiry);
        emit DetachmentRaised(bricsLo, bricsHi);
    }

    function enforceSoftCapExpiry(uint16 revertHi) external onlyRole(ECC_ROLE) {
        if (softCapExpiry == 0) revert SoftCapExpiredNotSet();
        if (block.timestamp <= softCapExpiry) revert Cooldown();
        bricsHi = revertHi;
        lastDetachmentUpdateTs = block.timestamp;
        softCapExpiry = 0;
        expansionTier = 0;
        emit SoftCapReverted(bricsLo, bricsHi, "soft-cap expired");
    }

    /**
     * @dev Expand to Tier 2 (106-108%) with sovereign guarantee claim validation
     * @param claimId Active sovereign claim ID
     * @param irbBalance Current IRB balance
     * @param preBufferBalance Current Pre-Tranche Buffer balance
     */
    function expandToTier2(
        uint256 claimId,
        uint256 irbBalance,
        uint256 preBufferBalance
    ) external onlyRole(ECC_ROLE) {
        uint8 level = uint8(ConfigRegistry(config).emergencyLevel());
        if (level != 3) revert EmergencyLevelRequired();
        if (expansionTier >= 2) revert AlreadyExpanded();
        
        // Validate claim and buffer requirements
        if (!claimRegistry.canExpandTier2(claimId, irbBalance, preBufferBalance)) {
            revert("Tier 2 requirements not met");
        }

        bricsHi = 10800; // 108%
        expansionTier = 2;
        tier2Expiry = block.timestamp + TIER2_EXPANSION_DURATION;
        lastDetachmentUpdateTs = block.timestamp;

        emit Tier2Expansion(10800, claimId, tier2Expiry);
        emit DetachmentRaised(bricsLo, bricsHi);
    }

    /**
     * @dev Enforce Tier 2 expiry
     */
    function enforceTier2Expiry(uint16 revertHi) external onlyRole(ECC_ROLE) {
        if (tier2Expiry == 0) revert("Tier 2 not active");
        if (block.timestamp <= tier2Expiry) revert Cooldown();
        
        bricsHi = revertHi;
        lastDetachmentUpdateTs = block.timestamp;
        tier2Expiry = 0;
        expansionTier = 0;
        
        emit Tier2Reverted(bricsLo, bricsHi, "Tier 2 expired");
    }

    // Adaptive Tranching v0.1 functions (no economic impact)

    /**
     * @notice Get current tranching mode
     * @return Current mode (0=DISABLED, 1=DRY_RUN, 2=ENFORCED)
     */
    function getTranchingMode() external view returns (uint8) {
        return tranchingMode;
    }

    /**
     * @notice Get current thresholds
     * @return sovereignUsageBps Sovereign usage threshold
     * @return defaultsBps Defaults threshold
     * @return corrPpm Correlation threshold
     */
    function getTranchingThresholds() external view returns (
        uint64 sovereignUsageBps,
        uint64 defaultsBps,
        uint32 corrPpm
    ) {
        return (sovereignUsageThresholdBps, defaultsThresholdBps, correlationThresholdPpm);
    }

    /**
     * @notice Submit a risk signal (restricted access)
     * @param signal The risk signal to submit
     * @dev Only callable by authorized oracles in DRY_RUN or ENFORCED mode
     */
    function submitSignal(IAdaptiveTranching.RiskSignal calldata signal) external {
        require(tranchingMode > 0, "Adaptive tranching disabled");
        require(hasRole(ECC_ROLE, msg.sender) || hasRole(GOV_ROLE, msg.sender), "unauthorized");
        
        emit RiskSignalSubmitted(signal, msg.sender);
        
        // No economic logic in v0.1 - only event emission
    }

    // Governance hooks for Adaptive Tranching v0.1

    /**
     * @notice Set tranching mode (only governance)
     * @param mode New mode (0=DISABLED, 1=DRY_RUN, 2=ENFORCED)
     * @dev Only callable by GOV_ROLE
     */
    function setTranchingMode(uint8 mode) external onlyRole(GOV_ROLE) {
        require(mode <= 2, "Invalid mode");
        uint8 oldMode = tranchingMode;
        tranchingMode = mode;
        emit TranchingModeChanged(mode, msg.sender);
    }

    /**
     * @notice Set tranching thresholds (only governance)
     * @param sovereignUsageBps Sovereign usage threshold in bps
     * @param defaultsBps Defaults threshold in bps
     * @param corrPpm Correlation threshold in ppm
     * @dev Only callable by GOV_ROLE
     */
    function setTranchingThresholds(
        uint64 sovereignUsageBps,
        uint64 defaultsBps,
        uint32 corrPpm
    ) external onlyRole(GOV_ROLE) {
        require(sovereignUsageBps <= 10000, "Sovereign usage > 100%");
        require(defaultsBps <= 10000, "Defaults > 100%");
        require(corrPpm <= 1000000, "Correlation > 100%");
        
        sovereignUsageThresholdBps = sovereignUsageBps;
        defaultsThresholdBps = defaultsBps;
        correlationThresholdPpm = corrPpm;
        
        emit ThresholdsUpdated(sovereignUsageBps, defaultsBps, corrPpm);
    }
}
