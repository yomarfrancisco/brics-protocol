// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITrancheRiskOracle} from "./ITrancheRiskOracle.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TrancheRiskOracleAdapter
 * @notice Adapter for tranche risk oracle with staleness guards and governance controls
 */
contract TrancheRiskOracleAdapter is AccessControl {
    bytes32 public constant GOV_ROLE = keccak256("GOV_ROLE");
    
    ITrancheRiskOracle public oracle;
    uint64 public maxAge;
    
    event RiskOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event RiskMaxAgeUpdated(uint64 indexed oldMaxAge, uint64 indexed newMaxAge);
    error StaleRiskData(uint64 timestamp, uint64 maxAge);
    
    constructor(address _oracle, uint64 _maxAge) {
        oracle = ITrancheRiskOracle(_oracle);
        maxAge = _maxAge;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOV_ROLE, msg.sender);
    }
    
    /**
     * @notice Get latest risk adjustment with staleness check
     * @param trancheId The tranche identifier
     * @return riskAdjBps Risk adjustment in basis points
     * @return ts Timestamp when data was last updated
     */
    function latestRisk(uint256 trancheId) external view returns (uint16 riskAdjBps, uint64 ts) {
        (, riskAdjBps, ts) = oracle.latestTrancheRisk(trancheId);
        
        // Check staleness
        if (block.timestamp - ts > maxAge) {
            revert StaleRiskData(ts, maxAge);
        }
    }
    
    /**
     * @notice Set the oracle address (governance only)
     * @param newOracle New oracle address
     */
    function setOracle(address newOracle) external onlyRole(GOV_ROLE) {
        address oldOracle = address(oracle);
        oracle = ITrancheRiskOracle(newOracle);
        emit RiskOracleUpdated(oldOracle, newOracle);
    }
    
    /**
     * @notice Set the maximum age for risk data (governance only)
     * @param newMaxAge New maximum age in seconds
     */
    function setMaxAge(uint64 newMaxAge) external onlyRole(GOV_ROLE) {
        uint64 oldMaxAge = maxAge;
        maxAge = newMaxAge;
        emit RiskMaxAgeUpdated(oldMaxAge, newMaxAge);
    }
}
