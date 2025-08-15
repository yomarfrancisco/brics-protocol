// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TrancheMath
 * @notice Library for tranche APY calculations
 */
library TrancheMath {
    /**
     * @notice Calculate effective APY in basis points
     * @param baseApyBps Base annual percentage yield in basis points
     * @param riskAdjBps Risk adjustment in basis points (subtracted from base)
     * @param maxApyBps Maximum allowed APY in basis points
     * @return effectiveApyBps Effective APY clamped to [0, maxApyBps]
     */
    function effectiveApyBps(
        uint16 baseApyBps, 
        uint16 riskAdjBps, 
        uint16 maxApyBps
    ) internal pure returns (uint16 effectiveApyBps) {
        // Calculate base - risk adjustment
        if (baseApyBps > riskAdjBps) {
            effectiveApyBps = baseApyBps - riskAdjBps;
        } else {
            effectiveApyBps = 0;
        }
        
        // Clamp to maximum
        if (effectiveApyBps > maxApyBps) {
            effectiveApyBps = maxApyBps;
        }
    }
}
