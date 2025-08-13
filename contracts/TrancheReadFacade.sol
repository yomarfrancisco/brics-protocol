// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TrancheMath} from "./libraries/TrancheMath.sol";
import {ITrancheRiskOracle} from "./oracle/ITrancheRiskOracle.sol";

/**
 * @title TrancheReadFacade
 * @notice Read-only facade for tranche APY calculations
 */
contract TrancheReadFacade {
    ITrancheRiskOracle public immutable oracle;
    address public immutable config;

    constructor(ITrancheRiskOracle _oracle, address _config) {
        oracle = _oracle;
        config = _config;
    }

    /**
     * @notice Get effective APY for a tranche
     * @param trancheId The tranche identifier
     * @return apyBps Effective APY in basis points
     * @return asOf Timestamp when the data was last updated
     */
    function viewEffectiveApy(uint256 trancheId) external view returns (uint16 apyBps, uint64 asOf) {
        (uint16 baseApyBps, uint16 riskAdjBps, uint64 oracleAsOf) = oracle.latestTrancheRisk(trancheId);
        
        // Get max APY from config (reuse maxBoundBps for now)
        uint16 maxApyBps = _getMaxApyBps();
        
        // Calculate effective APY
        apyBps = TrancheMath.effectiveApyBps(baseApyBps, riskAdjBps, maxApyBps);
        asOf = oracleAsOf;
    }

    /**
     * @notice Get raw tranche risk data
     * @param trancheId The tranche identifier
     * @return baseApyBps Base APY in basis points
     * @return riskAdjBps Risk adjustment in basis points
     * @return effectiveApyBps Effective APY in basis points
     * @return maxApyBps Maximum allowed APY in basis points
     * @return asOf Timestamp when the data was last updated
     */
    function viewTrancheRiskData(uint256 trancheId) external view returns (
        uint16 baseApyBps,
        uint16 riskAdjBps,
        uint16 effectiveApyBps,
        uint16 maxApyBps,
        uint64 asOf
    ) {
        (baseApyBps, riskAdjBps, asOf) = oracle.latestTrancheRisk(trancheId);
        maxApyBps = _getMaxApyBps();
        effectiveApyBps = TrancheMath.effectiveApyBps(baseApyBps, riskAdjBps, maxApyBps);
    }

    /**
     * @notice Internal function to get max APY from config
     * @return maxApyBps Maximum APY in basis points
     */
    function _getMaxApyBps() internal view returns (uint16 maxApyBps) {
        // For now, reuse maxBoundBps from ConfigRegistry
        // In the future, this could be a dedicated maxApyBps parameter
        try IConfigRegistryLike(config).maxBoundBps() returns (uint256 maxBound) {
            maxApyBps = uint16(maxBound);
        } catch {
            // Fallback to reasonable default
            maxApyBps = 1000; // 10%
        }
    }
}

// Interface for ConfigRegistry calls
interface IConfigRegistryLike {
    function maxBoundBps() external view returns (uint256);
}
