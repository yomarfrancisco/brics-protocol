// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IConfigRegistry
 * @notice Interface for config registry
 */
interface IConfigRegistry {
    struct CurrentParams {
        uint256 ammMaxSlippageBps;
        uint256 redeemCapBps;
        uint256 emergencyLevel;
    }

    /**
     * @notice Get current emergency level
     * @return Emergency level
     */
    function emergencyLevel() external view returns (uint256);

    /**
     * @notice Get redeem cap in basis points
     * @return Redeem cap in basis points
     */
    function redeemCapBps() external view returns (uint256);

    /**
     * @notice Get current parameters
     * @return Current parameters
     */
    function getCurrentParams() external view returns (CurrentParams memory);
}

