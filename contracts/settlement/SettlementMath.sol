// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library SettlementMath {
    int256 internal constant BPS_DENOM = 10_000;

    function roundHalfUp(int256 numer, int256 denom) internal pure returns (int256) {
        require(denom > 0, "DENOM_ZERO");
        if (numer >= 0) {
            return (numer + denom / 2) / denom;
        } else {
            // Ensure symmetric half-up for negatives.
            int256 pos = -numer;
            return -((pos + denom / 2) / denom);
        }
    }

    /// @notice compute PnL in smallest units (can be negative)
    function computeSettlementPnl(
        uint16 fairSpreadBps,
        uint16 fixedSpreadBps,
        uint256 notional,      // smallest units
        uint32 elapsedDays,
        uint32 tenorDays
    ) internal pure returns (int256 pnl) {
        require(fairSpreadBps >= 1 && fairSpreadBps <= 10_000, "FAIR_BPS_OOB");
        require(fixedSpreadBps >= 1 && fixedSpreadBps <= 10_000, "FIXED_BPS_OOB");
        require(elapsedDays >= 1 && tenorDays >= elapsedDays, "DAYS_OOB");
        require(tenorDays <= 36500, "TENOR_OOB");
        require(notional > 0, "NOTIONAL_ZERO");

        int256 deltaBps = int256(uint256(fairSpreadBps) - uint256(fixedSpreadBps));
        int256 numer = deltaBps * int256(notional) * int256(uint256(elapsedDays));
        int256 denom = int256(BPS_DENOM) * int256(uint256(tenorDays));
        return roundHalfUp(numer, denom);
    }
}
