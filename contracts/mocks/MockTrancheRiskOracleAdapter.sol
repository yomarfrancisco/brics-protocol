// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockTrancheRiskOracleAdapter
 * @notice Mock tranche risk oracle adapter for testing
 */
contract MockTrancheRiskOracleAdapter {
    mapping(uint256 => uint16) public riskAdjBps;
    mapping(uint256 => uint64) public asOf;

    constructor() {}

    function setRisk(uint256 trancheId, uint16 _riskAdjBps, uint64 _asOf) external {
        riskAdjBps[trancheId] = _riskAdjBps;
        asOf[trancheId] = _asOf;
    }

    function latestRisk(uint256 trancheId) external view returns (uint16 _riskAdjBps, uint64 _asOf) {
        return (riskAdjBps[trancheId], asOf[trancheId]);
    }
}
