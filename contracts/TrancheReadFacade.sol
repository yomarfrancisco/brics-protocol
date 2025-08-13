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
        
        // Check for per-tranche base APY override first (takes precedence over oracle base APY)
        uint16 baseApyOverrideBps = IConfigRegistryLike(config).trancheBaseApyOverrideBps(trancheId);
        if (baseApyOverrideBps > 0) {
            baseApyBps = baseApyOverrideBps;
        }
        
        // Check for per-tranche risk adjustment override (takes precedence over adapter/oracle)
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
        
        // Apply rolling average if enabled (after override/adapter, before bands)
        uint16 rollingAvgBps;
        bool rollingUsed;
        (rollingAvgBps, rollingUsed) = _rollingAverage(trancheId, riskAdjBps, uint64(block.timestamp));
        if (rollingUsed) {
            riskAdjBps = rollingAvgBps;
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
        
        // Check for per-tranche base APY override first (takes precedence over oracle base APY)
        uint16 baseApyOverrideBps = IConfigRegistryLike(config).trancheBaseApyOverrideBps(trancheId);
        if (baseApyOverrideBps > 0) {
            baseApyBps = baseApyOverrideBps;
        }
        
        // Check for per-tranche risk adjustment override (takes precedence over adapter/oracle)
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
        
        // Apply rolling average if enabled (after override/adapter, before bands)
        uint16 rollingAvgBps;
        bool rollingUsed;
        (rollingAvgBps, rollingUsed) = _rollingAverage(trancheId, riskAdjBps, uint64(block.timestamp));
        if (rollingUsed) {
            riskAdjBps = rollingAvgBps;
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
     * @return oracleBaseApyBps Original base APY from oracle
     * @return baseApyOverrideBps Base APY override (0 if not set)
     * @return oracleRiskAdjBps Original risk adjustment from oracle
     * @return overrideRiskAdjBps Override risk adjustment (0 if not set)
     * @return adapterRiskAdjBps Adapter risk adjustment (0 if not used)
     * @return finalRiskAdjBps Final risk adjustment after all logic
     * @return effectiveApyBps Effective APY in basis points
     * @return maxApyBps Maximum allowed APY in basis points
     * @return floorBps Risk floor from confidence bands (0 if disabled)
     * @return ceilBps Risk ceiling from confidence bands (0 if disabled)
     * @return asOf Timestamp when the data was last updated
     * @return telemetryFlags Bit flags indicating decision path taken (uint16)
     * @return rollingAverageBps Rolling average risk adjustment (0 if not used)
     * @return rollingWindowDays Rolling window size in days (0 if disabled)
     */
    function viewTrancheTelemetry(uint256 trancheId) external view returns (
        uint16 baseApyBps,
        uint16 oracleBaseApyBps,
        uint16 baseApyOverrideBps,
        uint16 oracleRiskAdjBps,
        uint16 overrideRiskAdjBps,
        uint16 adapterRiskAdjBps,
        uint16 finalRiskAdjBps,
        uint16 effectiveApyBps,
        uint16 maxApyBps,
        uint16 floorBps,
        uint16 ceilBps,
        uint64 asOf,
        uint16 telemetryFlags,
        uint16 rollingAverageBps,
        uint16 rollingWindowDays
    ) {
        // Get base data from oracle
        (oracleBaseApyBps, oracleRiskAdjBps, asOf) = oracle.latestTrancheRisk(trancheId);
        
        // Initialize telemetry flags and adapter risk
        telemetryFlags = 0;
        adapterRiskAdjBps = 0;
        
        // Check for per-tranche base APY override first (takes precedence over oracle base APY)
        baseApyOverrideBps = IConfigRegistryLike(config).trancheBaseApyOverrideBps(trancheId);
        if (baseApyOverrideBps > 0) {
            baseApyBps = baseApyOverrideBps;
            telemetryFlags |= 0x01; // FLAG_BASE_APY_OVERRIDE_USED
        } else {
            baseApyBps = oracleBaseApyBps;
        }
        
        // Check for per-tranche risk adjustment override
        overrideRiskAdjBps = IConfigRegistryLike(config).trancheRiskAdjOverrideBps(trancheId);
        if (overrideRiskAdjBps > 0) {
            finalRiskAdjBps = overrideRiskAdjBps;
            telemetryFlags |= 0x02; // FLAG_RISK_OVERRIDE_USED
        } else {
            // Use adapter for risk adjustment if enabled
            if (enableTrancheRisk && address(riskAdapter) != address(0)) {
                uint64 adapterTs;
                (adapterRiskAdjBps, adapterTs) = riskAdapter.latestRisk(trancheId);
                finalRiskAdjBps = adapterRiskAdjBps;
                asOf = adapterTs;
                telemetryFlags |= 0x04; // FLAG_ADAPTER_USED
            } else {
                finalRiskAdjBps = oracleRiskAdjBps;
                telemetryFlags |= 0x08; // FLAG_ORACLE_DIRECT
            }
        }
        
        // Apply rolling average if enabled (after override/adapter, before bands)
        rollingWindowDays = IConfigRegistryLike(config).trancheRollingWindowDays(trancheId);
        if (IConfigRegistryLike(config).trancheRollingEnabled(trancheId) && rollingWindowDays > 0) {
            telemetryFlags |= 0x10; // FLAG_ROLLING_AVG_ENABLED
            // Only apply rolling average if no override is set
            if (overrideRiskAdjBps == 0) {
                bool rollingUsed;
                (rollingAverageBps, rollingUsed) = _rollingAverage(trancheId, finalRiskAdjBps, uint64(block.timestamp));
                if (rollingUsed) {
                    finalRiskAdjBps = rollingAverageBps;
                    telemetryFlags |= 0x20; // FLAG_ROLLING_AVG_USED
                } else {
                    // If rolling average is not used (e.g., no data points), set to 0 for telemetry
                    rollingAverageBps = 0;
                }
            } else {
                rollingAverageBps = 0; // Override takes precedence, so rolling average not used
            }
        } else {
            rollingAverageBps = 0;
        }
        
        // Apply risk confidence bands
        floorBps = IConfigRegistryLike(config).trancheRiskFloorBps(trancheId);
        ceilBps = IConfigRegistryLike(config).trancheRiskCeilBps(trancheId);
        if (ceilBps > 0) { // Bands enabled
            telemetryFlags |= 0x40; // FLAG_BANDS_ENABLED
            if (finalRiskAdjBps < floorBps) {
                finalRiskAdjBps = floorBps;
                telemetryFlags |= 0x80; // FLAG_FLOOR_CLAMPED
            } else if (finalRiskAdjBps > ceilBps) {
                finalRiskAdjBps = ceilBps;
                telemetryFlags |= 0x100; // FLAG_CEIL_CLAMPED
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

    /**
     * @notice Calculate linear weight for rolling average (0-10000 scale)
     * @param age Age of data point in seconds
     * @param maxAge Maximum age in seconds
     * @return weight Linear weight (0-10000)
     */
    function _linearWeight(uint64 age, uint64 maxAge) internal pure returns (uint64 weight) {
        if (age >= maxAge) return 0;
        // Linear decay: weight = (maxAge - age) / maxAge * 10000
        return (maxAge - age) * 10000 / maxAge;
    }

    /**
     * @notice Calculate rolling average risk adjustment
     * @param trancheId The tranche identifier
     * @param rawRiskAdjBps Raw risk adjustment from oracle/adapter
     * @param currentTime Current timestamp
     * @return avgBps Rolling average in basis points
     * @return used Whether rolling average was used (vs raw value)
     */
    function _rollingAverage(uint256 trancheId, uint16 rawRiskAdjBps, uint64 currentTime) internal view returns (uint16 avgBps, bool used) {
        // Check if rolling average is enabled
        if (!IConfigRegistryLike(config).trancheRollingEnabled(trancheId)) {
            return (rawRiskAdjBps, false);
        }

        uint16 windowDays = IConfigRegistryLike(config).trancheRollingWindowDays(trancheId);
        if (windowDays == 0) {
            return (rawRiskAdjBps, false);
        }

        // Get rolling buffer data
        (uint8 count, uint8 index) = IConfigRegistryLike(config).rollingHead(trancheId);
        if (count == 0) {
            return (rawRiskAdjBps, false);
        }

        // Calculate cutoff time
        uint64 cutoffTime = currentTime - (uint64(windowDays) * 1 days);
        
        uint256 totalWeight = 0;
        uint256 weightedSum = 0;
        uint64 maxAge = uint64(windowDays) * 1 days;

        // Scan through data points in reverse order (newest first)
        for (uint8 i = 0; i < count; i++) {
            uint8 bufIndex;
            if (index > i) {
                bufIndex = index - 1 - i;
            } else {
                bufIndex = 30 - (i - index + 1);
            }
            (uint16 riskAdjBps, uint64 timestamp) = IConfigRegistryLike(config).getRollingDataPoint(trancheId, bufIndex);
            
            if (timestamp >= cutoffTime) {
                uint64 age = currentTime - timestamp;
                uint64 weight = _linearWeight(age, maxAge);
                weightedSum += uint256(riskAdjBps) * weight;
                totalWeight += weight;
            }
        }

        if (totalWeight == 0) {
            return (rawRiskAdjBps, false);
        }

        avgBps = uint16(weightedSum / totalWeight);
        used = (avgBps != rawRiskAdjBps);
        return (avgBps, used);
    }
}

// Interface for ConfigRegistry calls
interface IConfigRegistryLike {
    function maxBoundBps() external view returns (uint256);
    function trancheRiskAdjOverrideBps(uint256 trancheId) external view returns (uint16);
    function trancheRiskFloorBps(uint256 trancheId) external view returns (uint16);
    function trancheRiskCeilBps(uint256 trancheId) external view returns (uint16);
    function trancheRollingEnabled(uint256 trancheId) external view returns (bool);
    function trancheRollingWindowDays(uint256 trancheId) external view returns (uint16);
    function rollingHead(uint256 trancheId) external view returns (uint8 count, uint8 index);
    function getRollingDataPoint(uint256 trancheId, uint8 bufIndex) external view returns (uint16 riskAdjBps, uint64 timestamp);
    function trancheBaseApyOverrideBps(uint256 trancheId) external view returns (uint16);
}
