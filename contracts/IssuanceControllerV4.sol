// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IConfigRegistryLike} from "./interfaces/IConfigRegistryLike.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IssuanceControllerV4
 * @dev Adaptive issuance controls with detachment monotonicity, RED-halt, and ratification windows
 */
contract IssuanceControllerV4 is AccessControl, ReentrancyGuard {
    bytes32 public constant GOV_ROLE = keccak256("GOV");
    bytes32 public constant ECC_ROLE = keccak256("ECC");

    // Config keys
    bytes32 private constant K_EMERGENCY_LEVEL = keccak256("emergency.level");
    bytes32 private constant K_DETACH_MIN_COOLDOWN = keccak256("issuance.detach.cooldownSec");

    // State variables
    uint256 public superSeniorCap;                 // current cap in tokens (1e18)
    uint256 public detachmentBps;                  // e.g. 10_200 = 102.00%
    uint256 public lastDetachmentRaiseTs;
    bool public issuanceLocked;
    uint256 public pendingRatifyUntil;             // 0 if none; if >0 must be ratified by this ts

    // External dependencies
    IConfigRegistryLike public immutable configRegistry;
    IERC20 public immutable bricsToken;

    // Events
    event CapAdjusted(uint256 newCap);
    event DetachmentRaised(uint256 newBps, uint256 ratifyUntil);
    event DetachmentRatified();
    event DetachmentLowered(uint256 newBps);
    event IssuanceLocked();
    event IssuanceUnlocked();
    event TriggersFired(uint256 defaultsBps, uint256 sovereignUsageBps, uint256 correlationBps, uint256 newCap, uint256 newDetachBps);

    constructor(
        address _configRegistry,
        address _bricsToken,
        uint256 _initialCap,
        uint256 _initialDetachmentBps
    ) {
        configRegistry = IConfigRegistryLike(_configRegistry);
        bricsToken = IERC20(_bricsToken);
        
        superSeniorCap = _initialCap;
        detachmentBps = _initialDetachmentBps;
        issuanceLocked = false;
        pendingRatifyUntil = 0;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOV_ROLE, msg.sender);
        _grantRole(ECC_ROLE, msg.sender);
    }

    modifier onlyGov() {
        require(hasRole(GOV_ROLE, msg.sender), "IC/ONLY_GOV");
        _;
    }

    modifier onlyEcc() {
        require(hasRole(ECC_ROLE, msg.sender), "IC/ONLY_ECC");
        _;
    }

    // Governance functions
    function setSuperSeniorCap(uint256 newCap) external onlyGov {
        superSeniorCap = newCap;
        emit CapAdjusted(newCap);
    }

    function raiseDetachment(uint256 newBps) external onlyGov {
        require(newBps > detachmentBps, "IC/ONLY_UP");
        
        detachmentBps = newBps;
        lastDetachmentRaiseTs = block.timestamp;
        pendingRatifyUntil = block.timestamp + 24 hours;
        
        emit DetachmentRaised(newBps, pendingRatifyUntil);
    }

    function lowerDetachment(uint256 newBps) external onlyGov {
        require(newBps < detachmentBps, "IC/ONLY_DOWN");
        
        uint256 cooldown = _getOrDefault(K_DETACH_MIN_COOLDOWN, 7 days);
        require(block.timestamp >= lastDetachmentRaiseTs + cooldown, "IC/COOLDOWN");
        require(pendingRatifyUntil == 0, "IC/PENDING_RATIFY");
        
        detachmentBps = newBps;
        emit DetachmentLowered(newBps);
    }

    function ratifyDetachment() external onlyGov {
        require(pendingRatifyUntil > 0, "IC/NO_PENDING");
        require(block.timestamp <= pendingRatifyUntil, "IC/RATIFY_EXPIRED");
        
        pendingRatifyUntil = 0;
        emit DetachmentRatified();
    }

    function lockIssuance() external onlyEcc {
        issuanceLocked = true;
        emit IssuanceLocked();
    }

    function unlockIssuance() external onlyEcc {
        issuanceLocked = false;
        emit IssuanceUnlocked();
    }

    function adjustByTriggers(
        uint256 currentDefaultsBps,
        uint256 sovereignUsageBps,
        uint256 correlationBps
    ) external onlyEcc {
        bool triggerFired = false;
        uint256 newCap = superSeniorCap;
        uint256 newDetachBps = detachmentBps;
        uint256 maxCapReduction = 0;
        uint256 totalDetachIncrease = 0;

        // Check sovereign usage trigger (>20%)
        if (sovereignUsageBps > 2000) {
            triggerFired = true;
            maxCapReduction = 10; // 10% reduction
            totalDetachIncrease += 100; // +1% detachment
        }

        // Check defaults trigger (>threshold)
        if (currentDefaultsBps > 500) { // 5% threshold
            triggerFired = true;
            if (15 > maxCapReduction) maxCapReduction = 15; // 15% reduction (more severe)
            totalDetachIncrease += 200; // +2% detachment
        }

        // Check correlation trigger (>65%)
        if (correlationBps > 6500) {
            triggerFired = true;
            if (20 > maxCapReduction) maxCapReduction = 20; // 20% reduction (most severe)
            totalDetachIncrease += 300; // +3% detachment
        }

        if (triggerFired) {
            newCap = (superSeniorCap * (100 - maxCapReduction)) / 100;
            newDetachBps = detachmentBps + totalDetachIncrease;
            
            superSeniorCap = newCap;
            detachmentBps = newDetachBps;
            pendingRatifyUntil = block.timestamp + 24 hours;
            
            emit TriggersFired(currentDefaultsBps, sovereignUsageBps, correlationBps, newCap, newDetachBps);
        }
    }

    // Mint gate function
    function checkMintAllowed(uint256 tokens) external view returns (bool) {
        // Check if issuance is locked
        if (issuanceLocked) {
            revert("IC/LOCKED");
        }

        // Check emergency level (RED = 2)
        uint256 emergencyLevel = _getOrDefault(K_EMERGENCY_LEVEL, 0);
        if (emergencyLevel >= 2) {
            revert("IC/RED_HALT");
        }

        // Check ratification window
        if (pendingRatifyUntil > 0 && block.timestamp > pendingRatifyUntil) {
            revert("IC/RATIFY_EXPIRED");
        }

        // Check cap
        uint256 currentSupply = bricsToken.totalSupply();
        if (currentSupply + tokens > superSeniorCap) {
            revert("IC/CAP");
        }

        return true;
    }

    // View functions
    function getCurrentState() external view returns (
        uint256 cap,
        uint256 detachment,
        bool locked,
        uint256 ratifyUntil,
        uint256 emergencyLevel
    ) {
        return (
            superSeniorCap,
            detachmentBps,
            issuanceLocked,
            pendingRatifyUntil,
            _getOrDefault(K_EMERGENCY_LEVEL, 0)
        );
    }

    function canMint(uint256 tokens) external view returns (bool) {
        try this.checkMintAllowed(tokens) {
            return true;
        } catch {
            return false;
        }
    }

    // Internal functions
    function _getOrDefault(bytes32 key, uint256 defaultValue) internal view returns (uint256) {
        try configRegistry.getUint(key) returns (uint256 value) {
            return value == 0 ? defaultValue : value;
        } catch {
            return defaultValue;
        }
    }
}
