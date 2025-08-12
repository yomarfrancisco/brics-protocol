// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRedemptionClaim
 * @notice Interface for redemption claim
 */
interface IRedemptionClaim {
    enum RedemptionLane { INSTANT, PRIMARY }

    struct Claim {
        uint256 id;
        address holder;
        uint256 amount;
        uint256 strikeTs;
        RedemptionLane lane;
        bool settled;
        uint256 usdcOwed;
        uint256 settlementTs;
    }

    /**
     * @notice Mint a new claim
     * @param holder Claim holder
     * @param amount Amount
     * @param strikeTs Strike timestamp
     * @param lane Redemption lane
     * @return Claim ID
     */
    function mint(
        address holder,
        uint256 amount,
        uint256 strikeTs,
        RedemptionLane lane
    ) external returns (uint256);

    /**
     * @notice Get claim by ID
     * @param claimId Claim ID
     * @return Claim data
     */
    function getClaim(uint256 claimId) external view returns (Claim memory);

    /**
     * @notice Get claims for a specific strike
     * @param strikeTs Strike timestamp
     * @return Array of claim IDs
     */
    function getClaimsForStrike(uint256 strikeTs) external view returns (uint256[] memory);

    /**
     * @notice Mark claim as settled
     * @param claimId Claim ID
     * @param usdcOwed USDC amount owed
     * @param settlementTs Settlement timestamp
     */
    function markSettled(uint256 claimId, uint256 usdcOwed, uint256 settlementTs) external;

    /**
     * @notice Settle and burn claim
     * @param claimId Claim ID
     */
    function settleAndBurn(uint256 claimId) external;
}
