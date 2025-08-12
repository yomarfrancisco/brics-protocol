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
}
