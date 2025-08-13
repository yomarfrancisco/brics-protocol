// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TrancheMath} from "./libraries/TrancheMath.sol";
import {ITrancheRiskOracle} from "./oracle/ITrancheRiskOracle.sol";
import {TrancheRiskOracleAdapter} from "./oracle/TrancheRiskOracleAdapter.sol";

/**
 * @title TrancheReadFacade
 * @notice Read-only facade for tranche APY calculations
 */
contract TrancheReadFacade {
    ITrancheRiskOracle public immutable oracle;
    address public immutable config;
    TrancheRiskOracleAdapter public immutable riskAdapter;
    bool public immutable enableTrancheRisk;

    constructor(
        ITrancheRiskOracle _oracle, 
        address _config,
        TrancheRiskOracleAdapter _riskAdapter,
        bool _enableTrancheRisk
    ) {
        oracle = _oracle;
        config = _config;
        riskAdapter = _riskAdapter;
        enableTrancheRisk = _enableTrancheRisk;
    }

    /**
     * @notice Get effective APY for a tranche
     * @param trancheId The tranche identifier
     * @return apyBps Effective APY in basis points
     * @return asOf Timestamp when the data was last updated
     */
    function viewEffectiveApy(uint256 trancheId) external view returns (uint16 apyBps, uint64 asOf) {
        (uint16 baseApyBps, uint16 riskAdjBps, uint64 oracleAsOf) = oracle.latestTrancheRisk(trancheId);
        
        // Check for per-tranche override first (takes precedence over adapter/oracle)
        uint16 overrideBps = IConfigRegistryLike(config).trancheRiskAdjOverrideBps(trancheId);
        if (overrideBps > 0) {
            riskAdjBps = overrideBps;
        } else {
            // Use adapter for risk adjustment if enabled and no override
            if (enableTrancheRisk && address(riskAdapter) != address(0)) {
                (uint16 adapterRiskAdj, uint64 adapterTs) = riskAdapter.latestRisk(trancheId);
                riskAdjBps = adapterRiskAdj;
                oracleAsOf = adapterTs;
            }
        }
        
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
        
        // Check for per-tranche override first (takes precedence over adapter/oracle)
        uint16 overrideBps = IConfigRegistryLike(config).trancheRiskAdjOverrideBps(trancheId);
        if (overrideBps > 0) {
            riskAdjBps = overrideBps;
        } else {
            // Use adapter for risk adjustment if enabled and no override
            if (enableTrancheRisk && address(riskAdapter) != address(0)) {
                (uint16 adapterRiskAdj, uint64 adapterTs) = riskAdapter.latestRisk(trancheId);
                riskAdjBps = adapterRiskAdj;
                asOf = adapterTs;
            }
        }
        
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
    function trancheRiskAdjOverrideBps(uint256 trancheId) external view returns (uint16);
}
