// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISovereignCapacityOracle} from "../oracle/ISovereignCapacityOracle.sol";

/**
 * @title IssuanceGuard
 * @notice Library for enforcing issuance caps based on sovereign capacity
 */
library IssuanceGuard {
    error IssuanceCapExceeded(uint256 requested, uint256 available, uint256 totalOutstanding);
    error StaleCapacityData(uint64 asOf, uint64 maxAge);

    /**
     * @notice Check if issuance is allowed within capacity limits
     * @param oracle Sovereign capacity oracle
     * @param config Config registry with issuance parameters
     * @param totalOutstanding Current total outstanding issuance
     * @param requested Amount being requested for issuance
     * @param maxAge Maximum age of capacity data in seconds (0 = no staleness check)
     */
    function checkIssuanceCap(
        ISovereignCapacityOracle oracle,
        address config,
        uint256 totalOutstanding,
        uint256 requested,
        uint256 maxAge
    ) external view {
        (uint256 capacity, uint64 asOf) = oracle.latestCapacity();
        
        // Check for stale data if maxAge > 0
        if (maxAge > 0 && block.timestamp > asOf + uint64(maxAge)) {
            revert StaleCapacityData(asOf, uint64(maxAge));
        }

        // Get max issuable from config
        uint256 maxIssuable = _getMaxIssuable(config, capacity);
        
        // Check if issuance would exceed cap
        if (totalOutstanding + requested > maxIssuable) {
            revert IssuanceCapExceeded(requested, maxIssuable - totalOutstanding, totalOutstanding);
        }
    }

    /**
     * @notice Get max issuable amount for given capacity
     * @param config Config registry address
     * @param capacity Oracle capacity
     * @return maxIssuable Maximum amount that can be issued
     */
    function getMaxIssuable(address config, uint256 capacity) external view returns (uint256 maxIssuable) {
        return _getMaxIssuable(config, capacity);
    }

    /**
     * @notice Internal function to get max issuable
     * @param config Config registry address
     * @param capacity Oracle capacity
     * @return maxIssuable Maximum amount that can be issued
     */
    function _getMaxIssuable(address config, uint256 capacity) internal view returns (uint256 maxIssuable) {
        // Call ConfigRegistry.getMaxIssuable if available
        try IConfigRegistryLike(config).getMaxIssuable(capacity) returns (uint256 max) {
            maxIssuable = max;
        } catch {
            // Fallback to default 95% buffer if config call fails
            maxIssuable = capacity * 9500 / 10000; // 95% of capacity
        }
    }
}

// Interface for ConfigRegistry calls
interface IConfigRegistryLike {
    function getMaxIssuable(uint256 oracleCapacity) external view returns (uint256 maxIssuable);
}
