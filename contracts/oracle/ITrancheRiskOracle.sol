// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITrancheRiskOracle
 * @notice Interface for tranche risk oracle that provides APY and risk data
 */
interface ITrancheRiskOracle {
    /**
     * @notice Get the latest tranche risk data
     * @param trancheId The tranche identifier
     * @return baseApyBps Base annual percentage yield in basis points
     * @return riskAdjBps Risk adjustment in basis points (subtracted from base)
     * @return asOf Timestamp when the data was last updated
     */
    function latestTrancheRisk(uint256 trancheId) external view returns (
        uint16 baseApyBps, 
        uint16 riskAdjBps, 
        uint64 asOf
    );
}
