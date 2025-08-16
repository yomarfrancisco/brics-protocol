// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISovereignBuffer
 * @dev Interface for sovereign buffer adapters
 * @notice Defines the interface for sovereign guarantee buffer interactions
 * @author BRICS Protocol
 */
interface ISovereignBuffer {
    // ============ Events ============
    
    event UtilizationReported(uint16 bps);
    event TopUpRequested(uint256 amount);
    
    // ============ Functions ============
    
    /**
     * @notice Report utilization to the sovereign buffer
     * @param bps Utilization in basis points (0-10000)
     */
    function reportUtilization(uint16 bps) external;
    
    /**
     * @notice Request a top-up from the sovereign buffer
     * @param amount Amount to request in base units
     */
    function requestTopUp(uint256 amount) external;
}
