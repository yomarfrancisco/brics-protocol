// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISovereignCapacityOracle
 * @notice Interface for sovereign capacity oracle that provides issuance limits
 */
interface ISovereignCapacityOracle {
    /**
     * @notice Get the latest sovereign capacity
     * @return capacity Capacity in underlying token smallest units (e.g., USDC 6dp)
     * @return asOf Timestamp when the capacity was last updated
     */
    function latestCapacity() external view returns (uint256 capacity, uint64 asOf);
}
