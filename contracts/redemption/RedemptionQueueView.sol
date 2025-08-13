// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITrancheRiskOracle} from "../oracle/ITrancheRiskOracle.sol";
import {TrancheReadFacade} from "../TrancheReadFacade.sol";

    // Configuration registry interface
    interface IConfigRegistryLike {
        function redemptionWeightRiskBps() external view returns (uint16);
        function redemptionWeightAgeBps() external view returns (uint16);
        function redemptionWeightSizeBps() external view returns (uint16);
        function redemptionMinAgeDays() external view returns (uint256);
        function redemptionSizeBoostThreshold() external view returns (uint256);
        function trancheRiskAdjOverrideBps(uint256 trancheId) external view returns (uint16);
        function trancheRiskFloorBps(uint256 trancheId) external view returns (uint16);
        function trancheRiskCeilBps(uint256 trancheId) external view returns (uint16);
        function trancheRollingEnabled(uint256 trancheId) external view returns (bool);
        function trancheRollingWindowDays(uint256 trancheId) external view returns (uint16);
        function trancheBaseApyOverrideBps(uint256 trancheId) external view returns (uint16);
    }

/**
 * @title RedemptionQueueView
 * @notice Read-only priority scoring for redemption queue management
 * @dev Computes deterministic priority scores based on risk, age, and size factors
 */
contract RedemptionQueueView {



    // Reason bits for priority scoring
    uint16 public constant REASON_RISK_HIGH = 0x0001;
    uint16 public constant REASON_SIZE_LARGE = 0x0002;
    uint16 public constant REASON_AGE_OLD = 0x0004;
    uint16 public constant REASON_CAP_PRESSURE = 0x0008;

    // Telemetry flags (reuse existing from TrancheReadFacade)
    uint16 public constant FLAG_BASE_APY_OVERRIDE_USED = 0x01;
    uint16 public constant FLAG_RISK_OVERRIDE_USED = 0x02;
    uint16 public constant FLAG_ADAPTER_USED = 0x04;
    uint16 public constant FLAG_ORACLE_DIRECT = 0x08;
    uint16 public constant FLAG_ROLLING_AVG_ENABLED = 0x10;
    uint16 public constant FLAG_ROLLING_AVG_USED = 0x20;
    uint16 public constant FLAG_BANDS_ENABLED = 0x40;
    uint16 public constant FLAG_FLOOR_CLAMPED = 0x80;
    uint16 public constant FLAG_CEIL_CLAMPED = 0x100;

    // Immutable dependencies
    IConfigRegistryLike public immutable config;
    TrancheReadFacade public immutable trancheFacade;

    // Priority score components structure
    struct PriorityComponents {
        uint256 riskScore;      // Weighted risk adjustment score
        uint256 ageScore;       // Weighted age score
        uint256 sizeScore;      // Weighted size score
        uint256 totalScore;     // Sum of all weighted scores
    }

    constructor(IConfigRegistryLike _config, TrancheReadFacade _trancheFacade) {
        config = _config;
        trancheFacade = _trancheFacade;
    }

    /**
     * @notice Calculate priority score for a redemption request
     * @param trancheId The tranche identifier
     * @param account The account requesting redemption
     * @param amount The redemption amount in tokens (18 decimals)
     * @param asOf Timestamp for the calculation
     * @return priorityScore The calculated priority score (higher = higher priority)
     * @return reasonBits Bit flags indicating priority factors
     * @return telemetryFlags Telemetry flags from risk calculation
     * @return components Detailed score components for debugging
     */
    function calculatePriorityScore(
        uint256 trancheId,
        address account,
        uint256 amount,
        uint64 asOf
    ) external view returns (
        uint256 priorityScore,
        uint16 reasonBits,
        uint16 telemetryFlags,
        PriorityComponents memory components
    ) {
        // Get configuration weights
        uint16 weightRiskBps = config.redemptionWeightRiskBps();
        uint16 weightAgeBps = config.redemptionWeightAgeBps();
        uint16 weightSizeBps = config.redemptionWeightSizeBps();
        
        // Validate weight sum doesn't exceed 10000 bps
        require(weightRiskBps + weightAgeBps + weightSizeBps <= 10000, "RQV/WEIGHT_SUM_EXCEEDED");

        // Get thresholds
        uint256 minAgeDays = config.redemptionMinAgeDays();
        uint256 sizeBoostThreshold = config.redemptionSizeBoostThreshold();

        // Calculate risk score component
        components.riskScore = _calculateRiskScore(trancheId, asOf, telemetryFlags);

        // Calculate age score component
        components.ageScore = _calculateAgeScore(asOf, minAgeDays);

        // Calculate size score component
        components.sizeScore = _calculateSizeScore(amount, sizeBoostThreshold);

        // Calculate total weighted score
        components.totalScore = (
            (components.riskScore * weightRiskBps) +
            (components.ageScore * weightAgeBps) +
            (components.sizeScore * weightSizeBps)
        ) / 10000;

        priorityScore = components.totalScore;

        // Set reason bits based on thresholds
        if (components.riskScore > 5000) reasonBits |= REASON_RISK_HIGH;
        if (components.sizeScore > 5000) reasonBits |= REASON_SIZE_LARGE;
        if (components.ageScore > 5000) reasonBits |= REASON_AGE_OLD;
        if (priorityScore > 7000) reasonBits |= REASON_CAP_PRESSURE;
    }

    /**
     * @notice Calculate risk score based on tranche risk data
     * @param trancheId The tranche identifier
     * @param asOf Timestamp for calculation
     * @param telemetryFlags Telemetry flags to populate
     * @return riskScore Risk score (0-10000)
     */
    function _calculateRiskScore(uint256 trancheId, uint64 asOf, uint16 telemetryFlags) internal view returns (uint256 riskScore) {
        // Get tranche risk data using the facade
        (
            uint16 baseApyBps,
            uint16 riskAdjBps,
            uint16 effectiveApyBps,
            uint16 maxApyBps,
            uint64 oracleAsOf
        ) = trancheFacade.viewTrancheRiskData(trancheId);

        // Risk score is based on risk adjustment (higher risk = higher priority)
        // Normalize to 0-10000 scale, with higher risk getting higher scores
        if (maxApyBps > 0) {
            // Higher risk adjustment = higher priority score
            riskScore = uint256(riskAdjBps) * 10000 / maxApyBps;
        } else {
            riskScore = 5000; // Default to middle if no max APY
        }

        // Clamp to 0-10000
        if (riskScore > 10000) riskScore = 10000;
    }

    /**
     * @notice Calculate age score based on time since request
     * @param asOf Current timestamp
     * @param minAgeDays Minimum age for boost
     * @return ageScore Age score (0-10000)
     */
    function _calculateAgeScore(uint64 asOf, uint256 minAgeDays) internal view returns (uint256 ageScore) {
        uint256 minAgeSeconds = minAgeDays * 1 days;
        uint256 currentAge = block.timestamp - asOf;

        if (currentAge < minAgeSeconds) {
            // No boost for young requests
            ageScore = 0;
        } else {
            // Linear boost up to 30 days, then capped
            uint256 maxAgeSeconds = 30 days;
            if (currentAge > maxAgeSeconds) {
                currentAge = maxAgeSeconds;
            }
            
            // Linear scale: 0 at minAge, 10000 at maxAge
            ageScore = (currentAge - minAgeSeconds) * 10000 / (maxAgeSeconds - minAgeSeconds);
        }
    }

    /**
     * @notice Calculate size score based on redemption amount
     * @param amount Redemption amount in tokens
     * @param sizeBoostThreshold Threshold for size boost
     * @return sizeScore Size score (0-10000)
     */
    function _calculateSizeScore(uint256 amount, uint256 sizeBoostThreshold) internal view returns (uint256 sizeScore) {
        if (amount < sizeBoostThreshold) {
            // No boost for small amounts
            sizeScore = 0;
        } else {
            // Logarithmic boost for large amounts
            // Use log base 10, scaled to 0-10000
            uint256 logAmount = _log10(amount);
            uint256 logThreshold = _log10(sizeBoostThreshold);
            
            if (logAmount > logThreshold) {
                uint256 logDiff = logAmount - logThreshold;
                // Scale log difference to 0-10000, with diminishing returns
                sizeScore = (logDiff * 10000) / 10; // Assume max 10x log difference
                if (sizeScore > 10000) sizeScore = 10000;
            } else {
                sizeScore = 0;
            }
        }
    }

    /**
     * @notice Calculate log base 10 of a number
     * @param x Input number
     * @return log10 Log base 10 result
     */
    function _log10(uint256 x) internal pure returns (uint256 log10) {
        if (x < 10) return 0;
        if (x < 100) return 1;
        if (x < 1000) return 2;
        if (x < 10000) return 3;
        if (x < 100000) return 4;
        if (x < 1000000) return 5;
        if (x < 10000000) return 6;
        if (x < 100000000) return 7;
        if (x < 1000000000) return 8;
        if (x < 10000000000) return 9;
        if (x < 100000000000) return 10;
        if (x < 1000000000000) return 11;
        if (x < 10000000000000) return 12;
        if (x < 100000000000000) return 13;
        if (x < 1000000000000000) return 14;
        if (x < 10000000000000000) return 15;
        if (x < 100000000000000000) return 16;
        if (x < 1000000000000000000) return 17;
        if (x < 10000000000000000000) return 18;
        if (x < 100000000000000000000) return 19;
        if (x < 1000000000000000000000) return 20;
        if (x < 10000000000000000000000) return 21;
        if (x < 100000000000000000000000) return 22;
        if (x < 1000000000000000000000000) return 23;
        if (x < 10000000000000000000000000) return 24;
        if (x < 100000000000000000000000000) return 25;
        if (x < 1000000000000000000000000000) return 26;
        if (x < 10000000000000000000000000000) return 27;
        if (x < 100000000000000000000000000000) return 28;
        if (x < 1000000000000000000000000000000) return 29;
        if (x < 10000000000000000000000000000000) return 30;
        return 31; // Max reasonable value for uint256
    }



    /**
     * @notice Get redemption weight configuration
     * @return weightRiskBps Risk weight in basis points
     * @return weightAgeBps Age weight in basis points
     * @return weightSizeBps Size weight in basis points
     */
    function getRedemptionWeights() external view returns (
        uint16 weightRiskBps,
        uint16 weightAgeBps,
        uint16 weightSizeBps
    ) {
        weightRiskBps = config.redemptionWeightRiskBps();
        weightAgeBps = config.redemptionWeightAgeBps();
        weightSizeBps = config.redemptionWeightSizeBps();
    }

    /**
     * @notice Get redemption threshold configuration
     * @return minAgeDays Minimum age for boost in days
     * @return sizeBoostThreshold Size threshold for boost in tokens
     */
    function getRedemptionThresholds() external view returns (
        uint256 minAgeDays,
        uint256 sizeBoostThreshold
    ) {
        minAgeDays = config.redemptionMinAgeDays();
        sizeBoostThreshold = config.redemptionSizeBoostThreshold();
    }
}
