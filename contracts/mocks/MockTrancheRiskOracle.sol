// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITrancheRiskOracle} from "../oracle/ITrancheRiskOracle.sol";

/**
 * @title MockTrancheRiskOracle
 * @notice Mock tranche risk oracle for testing
 */
contract MockTrancheRiskOracle is ITrancheRiskOracle {
    mapping(uint256 => uint16) public baseApyBps;
    mapping(uint256 => uint16) public riskAdjBps;
    mapping(uint256 => uint64) public asOf;

    constructor() {}

    function setTrancheRisk(
        uint256 trancheId, 
        uint16 _baseApyBps, 
        uint16 _riskAdjBps
    ) external {
        baseApyBps[trancheId] = _baseApyBps;
        riskAdjBps[trancheId] = _riskAdjBps;
        asOf[trancheId] = uint64(block.timestamp);
    }

    function setTrancheRiskWithTimestamp(
        uint256 trancheId, 
        uint16 _baseApyBps, 
        uint16 _riskAdjBps,
        uint64 _asOf
    ) external {
        baseApyBps[trancheId] = _baseApyBps;
        riskAdjBps[trancheId] = _riskAdjBps;
        asOf[trancheId] = _asOf;
    }

    function latestTrancheRisk(uint256 trancheId) external view override returns (
        uint16 _baseApyBps, 
        uint16 _riskAdjBps, 
        uint64 _asOf
    ) {
        return (baseApyBps[trancheId], riskAdjBps[trancheId], asOf[trancheId]);
    }
}
