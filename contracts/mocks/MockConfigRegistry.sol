// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IConfigRegistry} from "../interfaces/IConfigRegistry.sol";

/**
 * @title MockConfigRegistry
 * @notice Mock config registry for testing
 */
contract MockConfigRegistry is IConfigRegistry {
    uint256 public emergencyLevel;
    uint256 public redeemCapBps = 2500; // 25% default
    CurrentParams public currentParams;
    mapping(bytes32 => uint256) public configValues;

    constructor() {
        currentParams = CurrentParams({
            ammMaxSlippageBps: 500, // 5% default
            redeemCapBps: 2500, // 25% default
            emergencyLevel: 0
        });
    }

    function setEmergencyLevel(uint256 level) external {
        emergencyLevel = level;
        currentParams.emergencyLevel = level;
    }

    function setRedeemCapBps(uint256 cap) external {
        redeemCapBps = cap;
        currentParams.redeemCapBps = cap;
    }

    function setAmmMaxSlippageBps(uint256 slippage) external {
        currentParams.ammMaxSlippageBps = slippage;
    }

    function getCurrentParams() external view override returns (CurrentParams memory) {
        return currentParams;
    }

    function getUint(bytes32 key) external view returns (uint256) {
        // Mock implementation - return default values based on key
        if (key == keccak256("EMERGENCY_LEVEL")) {
            return emergencyLevel;
        } else if (key == keccak256("REDEEM_CAP_BPS")) {
            return redeemCapBps;
        } else if (key == keccak256("AMM_MAX_SLIPPAGE_BPS")) {
            return currentParams.ammMaxSlippageBps;
        }
        return configValues[key];
    }

    function setUint(bytes32 key, uint256 value) external {
        configValues[key] = value;
    }

    function getBoundsForLevel(uint8 level) external pure returns (uint256 minBps, uint256 maxBps) {
        if (level == 0) {
            // Level 0 (Normal): ±2%
            minBps = 9800;
            maxBps = 10200;
        } else if (level == 1) {
            // Level 1 (Amber): ±1%
            minBps = 9900;
            maxBps = 10100;
        } else if (level == 2) {
            // Level 2 (Red): ±0.25%
            minBps = 9975;
            maxBps = 10025;
        } else {
            // Level 3+ (Disabled): most restrictive
            minBps = 9975;
            maxBps = 10025;
        }
    }

    function getEconomics() external pure returns (
        uint256 tradeFeeBps,
        uint256 pmmCurveK_bps,
        uint256 pmmTheta_bps,
        uint256 maxBoundBps
    ) {
        return (50, 1000, 500, 5000); // Default values
    }
}
