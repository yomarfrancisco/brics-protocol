// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TrancheReadFacade} from "../TrancheReadFacade.sol";
import {ConfigRegistry} from "../ConfigRegistry.sol";

/**
 * @title RedemptionQueueView
 * @notice Read-only view contract for redemption queue prioritization
 * @dev Computes priority scores based on risk adjustment, age, and size with governance weights
 */
contract RedemptionQueueView {
    TrancheReadFacade public immutable facade;
    ConfigRegistry public immutable config;

    // Reason flags for priority scoring
    uint16 public constant FLAG_RISK_HIGH = 0x0001;      // High risk adjustment
    uint16 public constant FLAG_SIZE_LARGE = 0x0002;     // Large redemption amount
    uint16 public constant FLAG_AGE_OLD = 0x0004;        // Old redemption request
    uint16 public constant FLAG_CAP_PRESSURE = 0x0008;   // Near capacity limits

    constructor(TrancheReadFacade _facade, ConfigRegistry _config) {
        facade = _facade;
        config = _config;
    }

    /**
     * @notice Compute priority score for a redemption request
     * @param trancheId The tranche identifier
     * @param account The account requesting redemption
     * @param amount The redemption amount in USDC (6 decimals)
     * @param requestTimestamp The timestamp when the request was made
     * @return priorityScore The computed priority score (higher = higher priority)
     * @return reasonBits Bit flags indicating the reasons for the score
     * @return riskComponent The risk adjustment component of the score
     * @return ageComponent The age component of the score
     * @return sizeComponent The size component of the score
     */
    function computePriorityScore(
        uint256 trancheId,
        address account,
        uint256 amount,
        uint64 requestTimestamp
    ) external view returns (
        uint256 priorityScore,
        uint16 reasonBits,
        uint256 riskComponent,
        uint256 ageComponent,
        uint256 sizeComponent
    ) {
        // Get current timestamp
        uint64 currentTime = uint64(block.timestamp);
        
        // Get risk adjustment from facade
        (uint16 baseApyBps, uint16 oracleBaseApyBps, uint16 baseApyOverrideBps,
         uint16 oracleRiskAdjBps, uint16 overrideRiskAdjBps, uint16 adapterRiskAdjBps,
         uint16 finalRiskAdjBps, uint16 effectiveApyBps, uint16 maxApyBps,
         uint16 floorBps, uint16 ceilBps, uint64 asOf, uint16 telemetryFlags,
         uint16 rollingAverageBps, uint16 rollingWindowDays) = facade.viewTrancheTelemetry(trancheId);

        // Get redemption weights from config
        (uint16 riskWeightBps, uint16 ageWeightBps, uint16 sizeWeightBps) = config.getRedemptionWeights();
        (uint16 minAgeDays, uint16 sizeThreshold) = config.getRedemptionThresholds();

        // Calculate risk component (normalized to 0-10000)
        riskComponent = _calculateRiskComponent(finalRiskAdjBps, maxApyBps);
        
        // Calculate age component (normalized to 0-10000)
        ageComponent = _calculateAgeComponent(requestTimestamp, currentTime, minAgeDays);
        
        // Calculate size component (normalized to 0-10000)
        sizeComponent = _calculateSizeComponent(amount, sizeThreshold);

        // Compute weighted priority score
        priorityScore = (
            (riskComponent * riskWeightBps) +
            (ageComponent * ageWeightBps) +
            (sizeComponent * sizeWeightBps)
        ) / 10000;

        // Set reason bits based on components
        reasonBits = _calculateReasonBits(
            finalRiskAdjBps,
            amount,
            requestTimestamp,
            currentTime,
            minAgeDays,
            sizeThreshold
        );
    }

    /**
     * @notice Calculate risk component of priority score
     * @param riskAdjBps Risk adjustment in basis points
     * @param maxApyBps Maximum APY in basis points
     * @return riskComponent Risk component normalized to 0-10000
     */
    function _calculateRiskComponent(uint16 riskAdjBps, uint16 maxApyBps) internal pure returns (uint256 riskComponent) {
        // Higher risk adjustment = higher priority (more urgent)
        // Normalize to 0-10000 range
        if (maxApyBps == 0) return 0;
        riskComponent = (uint256(riskAdjBps) * 10000) / uint256(maxApyBps);
        if (riskComponent > 10000) riskComponent = 10000;
    }

    /**
     * @notice Calculate age component of priority score
     * @param requestTimestamp When the request was made
     * @param currentTime Current timestamp
     * @param minAgeDays Minimum age for boost
     * @return ageComponent Age component normalized to 0-10000
     */
    function _calculateAgeComponent(
        uint64 requestTimestamp,
        uint64 currentTime,
        uint16 minAgeDays
    ) internal pure returns (uint256 ageComponent) {
        if (currentTime <= requestTimestamp) return 0;
        
        uint256 ageSeconds = currentTime - requestTimestamp;
        uint256 ageDays = ageSeconds / 1 days;
        
        // No boost for requests younger than minimum age
        if (ageDays < minAgeDays) return 0;
        
        // Linear boost from minAgeDays to 365 days, then capped
        uint256 maxAgeDays = 365;
        if (ageDays > maxAgeDays) ageDays = maxAgeDays;
        
        // Normalize to 0-10000 range
        ageComponent = ((ageDays - minAgeDays) * 10000) / (maxAgeDays - minAgeDays);
    }

    /**
     * @notice Calculate size component of priority score
     * @param amount Redemption amount in USDC (6 decimals)
     * @param sizeThreshold Size threshold for boost
     * @return sizeComponent Size component normalized to 0-10000
     */
    function _calculateSizeComponent(uint256 amount, uint16 sizeThreshold) internal pure returns (uint256 sizeComponent) {
        // Convert amount to USDC units (6 decimals)
        uint256 amountUSDC = amount / 1e6;
        
        // No boost for amounts below threshold
        if (amountUSDC < sizeThreshold) return 0;
        
        // Linear boost from threshold to 10x threshold, then capped
        uint256 maxAmount = uint256(sizeThreshold) * 10;
        if (amountUSDC > maxAmount) amountUSDC = maxAmount;
        
        // Normalize to 0-10000 range
        sizeComponent = ((amountUSDC - sizeThreshold) * 10000) / (maxAmount - sizeThreshold);
    }

    /**
     * @notice Calculate reason bits for priority score
     * @param riskAdjBps Risk adjustment in basis points
     * @param amount Redemption amount
     * @param requestTimestamp When the request was made
     * @param currentTime Current timestamp
     * @param minAgeDays Minimum age for boost
     * @param sizeThreshold Size threshold for boost
     * @return reasonBits Bit flags indicating reasons for priority
     */
    function _calculateReasonBits(
        uint16 riskAdjBps,
        uint256 amount,
        uint64 requestTimestamp,
        uint64 currentTime,
        uint16 minAgeDays,
        uint16 sizeThreshold
    ) internal pure returns (uint16 reasonBits) {
        // Check for high risk (above 50% of typical range)
        if (riskAdjBps > 2500) { // 25% risk adjustment
            reasonBits |= FLAG_RISK_HIGH;
        }
        
        // Check for large size (above threshold)
        uint256 amountUSDC = amount / 1e6;
        if (amountUSDC >= sizeThreshold) {
            reasonBits |= FLAG_SIZE_LARGE;
        }
        
        // Check for old age (above minimum age)
        if (currentTime > requestTimestamp) {
            uint256 ageDays = (currentTime - requestTimestamp) / 1 days;
            if (ageDays >= minAgeDays) {
                reasonBits |= FLAG_AGE_OLD;
            }
        }
        
        // Note: CAP_PRESSURE would require additional context about current capacity
        // This is left for future implementation
    }

    /**
     * @notice Get redemption queue configuration
     * @return riskWeight Risk weight in basis points
     * @return ageWeight Age weight in basis points
     * @return sizeWeight Size weight in basis points
     * @return minAgeDays Minimum age for boost
     * @return sizeThreshold Size threshold for boost
     */
    function getRedemptionConfig() external view returns (
        uint16 riskWeight,
        uint16 ageWeight,
        uint16 sizeWeight,
        uint16 minAgeDays,
        uint16 sizeThreshold
    ) {
        (riskWeight, ageWeight, sizeWeight) = config.getRedemptionWeights();
        (minAgeDays, sizeThreshold) = config.getRedemptionThresholds();
    }
}
