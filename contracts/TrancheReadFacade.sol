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
        
        // Apply risk confidence bands (clamp riskAdjBps to [floor, ceil])
        uint16 floorBps = IConfigRegistryLike(config).trancheRiskFloorBps(trancheId);
        uint16 ceilBps = IConfigRegistryLike(config).trancheRiskCeilBps(trancheId);
        if (ceilBps > 0) { // Bands enabled
            if (riskAdjBps < floorBps) {
                riskAdjBps = floorBps;
            } else if (riskAdjBps > ceilBps) {
                riskAdjBps = ceilBps;
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
        
        // Apply risk confidence bands (clamp riskAdjBps to [floor, ceil])
        uint16 floorBps = IConfigRegistryLike(config).trancheRiskFloorBps(trancheId);
        uint16 ceilBps = IConfigRegistryLike(config).trancheRiskCeilBps(trancheId);
        if (ceilBps > 0) { // Bands enabled
            if (riskAdjBps < floorBps) {
                riskAdjBps = floorBps;
            } else if (riskAdjBps > ceilBps) {
                riskAdjBps = ceilBps;
            }
        }
        
        maxApyBps = _getMaxApyBps();
        effectiveApyBps = TrancheMath.effectiveApyBps(baseApyBps, riskAdjBps, maxApyBps);
    }

    /**
     * @notice Get comprehensive telemetry data for tranche risk calculations
     * @param trancheId The tranche identifier
     * @return baseApyBps Base APY in basis points
     * @return oracleRiskAdjBps Original risk adjustment from oracle
     * @return overrideRiskAdjBps Override risk adjustment (0 if not set)
     * @return adapterRiskAdjBps Adapter risk adjustment (0 if not used)
     * @return finalRiskAdjBps Final risk adjustment after all logic
     * @return effectiveApyBps Effective APY in basis points
     * @return maxApyBps Maximum allowed APY in basis points
     * @return floorBps Risk floor from confidence bands (0 if disabled)
     * @return ceilBps Risk ceiling from confidence bands (0 if disabled)
     * @return asOf Timestamp when the data was last updated
     * @return telemetryFlags Bit flags indicating decision path taken
     */
    function viewTrancheTelemetry(uint256 trancheId) external view returns (
        uint16 baseApyBps,
        uint16 oracleRiskAdjBps,
        uint16 overrideRiskAdjBps,
        uint16 adapterRiskAdjBps,
        uint16 finalRiskAdjBps,
        uint16 effectiveApyBps,
        uint16 maxApyBps,
        uint16 floorBps,
        uint16 ceilBps,
        uint64 asOf,
        uint8 telemetryFlags
    ) {
        // Get base data from oracle
        (baseApyBps, oracleRiskAdjBps, asOf) = oracle.latestTrancheRisk(trancheId);
        
        // Initialize telemetry flags and adapter risk
        telemetryFlags = 0;
        adapterRiskAdjBps = 0;
        
        // Check for per-tranche override
        overrideRiskAdjBps = IConfigRegistryLike(config).trancheRiskAdjOverrideBps(trancheId);
        if (overrideRiskAdjBps > 0) {
            finalRiskAdjBps = overrideRiskAdjBps;
            telemetryFlags |= 0x01; // FLAG_OVERRIDE_USED
        } else {
            // Use adapter for risk adjustment if enabled
            if (enableTrancheRisk && address(riskAdapter) != address(0)) {
                uint64 adapterTs;
                (adapterRiskAdjBps, adapterTs) = riskAdapter.latestRisk(trancheId);
                finalRiskAdjBps = adapterRiskAdjBps;
                asOf = adapterTs;
                telemetryFlags |= 0x02; // FLAG_ADAPTER_USED
            } else {
                finalRiskAdjBps = oracleRiskAdjBps;
                telemetryFlags |= 0x04; // FLAG_ORACLE_DIRECT
            }
        }
        
        // Apply risk confidence bands
        floorBps = IConfigRegistryLike(config).trancheRiskFloorBps(trancheId);
        ceilBps = IConfigRegistryLike(config).trancheRiskCeilBps(trancheId);
        if (ceilBps > 0) { // Bands enabled
            telemetryFlags |= 0x08; // FLAG_BANDS_ENABLED
            if (finalRiskAdjBps < floorBps) {
                finalRiskAdjBps = floorBps;
                telemetryFlags |= 0x10; // FLAG_FLOOR_CLAMPED
            } else if (finalRiskAdjBps > ceilBps) {
                finalRiskAdjBps = ceilBps;
                telemetryFlags |= 0x20; // FLAG_CEIL_CLAMPED
            }
        }
        
        maxApyBps = _getMaxApyBps();
        effectiveApyBps = TrancheMath.effectiveApyBps(baseApyBps, finalRiskAdjBps, maxApyBps);
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
    function trancheRiskFloorBps(uint256 trancheId) external view returns (uint16);
    function trancheRiskCeilBps(uint256 trancheId) external view returns (uint16);
}
