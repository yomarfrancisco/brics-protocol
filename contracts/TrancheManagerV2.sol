// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "./ConfigRegistry.sol";

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

    // Governance attestation
    uint256 public lastVoteYesBps;  // yes/total in bps
    uint256 public lastVoteTs;

    event CapAdjusted(uint256 cap);
    event IssuanceLocked(bool locked);
    event DetachmentRaised(uint16 lo, uint16 hi);
    event SoftCapExpanded(uint16 newHi, string reason, uint256 expiry);
    event SoftCapReverted(uint16 lo, uint16 hi, string reason);
    event SovereignGuaranteeConfirmed(bool confirmed);
    event TriggersBreachedSet(bool breached);
    event SupermajorityAttested(uint256 yesBps, uint256 ts);

    constructor(address gov, address oracle_, address config_) {
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
        oracle = oracle_;
        config = config_;
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
        ConfigRegistry.EmergencyLevel level = ConfigRegistry(config).emergencyLevel();
        if (level == ConfigRegistry.EmergencyLevel.RED && sovereignGuaranteeConfirmed) {
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
        ConfigRegistry.EmergencyLevel level = ConfigRegistry(config).emergencyLevel();
        if (level != ConfigRegistry.EmergencyLevel.RED) revert EmergencyLevelRequired();
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
        emit SoftCapReverted(bricsLo, bricsHi, "soft-cap expired");
    }
}
