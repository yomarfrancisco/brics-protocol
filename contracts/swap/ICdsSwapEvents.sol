// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ICdsSwapEvents
 * @notice Events for Credit Default Swap (CDS) operations
 * @dev Defines all events emitted by CDS swap contracts
 */
interface ICdsSwapEvents {
    // Settlement mode enum
    enum SettlementMode { ACCOUNTING, TRANSFERS }
    /**
     * @notice Emitted when a new CDS swap is proposed
     * @param swapId Unique identifier for the swap
     * @param portfolioId Portfolio identifier
     * @param proposer Address of the proposer
     * @param protectionBuyerCounterparty Address of the protection buyer
     * @param protectionSellerCounterparty Address of the protection seller
     * @param notional Notional amount in base units
     * @param spreadBps Spread in basis points
     * @param start Start timestamp
     * @param maturity Maturity timestamp
     * @param correlationBps Correlation factor in basis points
     */
    event SwapProposed(
        bytes32 indexed swapId,
        bytes32 indexed portfolioId,
        address indexed proposer,
        address protectionBuyerCounterparty,
        address protectionSellerCounterparty,
        uint256 notional,
        uint16 spreadBps,
        uint64 start,
        uint64 maturity,
        uint16 correlationBps
    );

    /**
     * @notice Emitted when a CDS swap is activated
     * @param swapId Unique identifier for the swap
     * @param activator Address of the activator (must have BROKER_ROLE)
     */
    event SwapActivated(
        bytes32 indexed swapId,
        address indexed activator
    );

    /**
     * @notice Emitted when a CDS swap is settled
     * @param swapId Unique identifier for the swap
     * @param settler Address of the settler
     * @param pnl Profit and loss amount (placeholder for future implementation)
     */
    event SwapSettled(
        bytes32 indexed swapId,
        address indexed settler,
        int256 pnl
    );

    /**
     * @notice Emitted when a CDS swap is cancelled
     * @param swapId Unique identifier for the swap
     * @param canceller Address of the canceller
     * @param reason Reason for cancellation (optional)
     */
    event SwapCancelled(
        bytes32 indexed swapId,
        address indexed canceller,
        string reason
    );

    /**
     * @notice Emitted when price oracle adapter is set
     * @param priceOracle Address of the price oracle adapter
     */
    event PriceOracleSet(address indexed priceOracle);

    /**
     * @notice Emitted when settlement token is set
     * @param token Address of the settlement token
     */
    event SettlementTokenSet(address indexed token);

    /**
     * @notice Emitted when settlement mode is changed
     * @param mode New settlement mode
     */
    event SettlementModeSet(SettlementMode mode);

    /**
     * @notice Emitted when settlement payment is made
     * @param swapId Unique identifier for the swap
     * @param payer Address of the payer
     * @param payee Address of the payee
     * @param amount Amount transferred
     */
    event SettlementPaid(bytes32 indexed swapId, address indexed payer, address indexed payee, uint256 amount);

    /**
     * @notice Emitted when settlement is executed with detailed PnL information
     * @param swapId Unique identifier for the swap
     * @param buyer Address of the protection buyer
     * @param seller Address of the protection seller
     * @param pnlSmallest PnL in smallest units (can be negative)
     * @param asOf Timestamp when settlement was executed
     * @param elapsedDays Number of days elapsed since swap start
     * @param tenorDays Total tenor days of the swap
     */
    event SettlementExecuted(
        bytes32 indexed swapId,
        address indexed buyer,
        address indexed seller,
        int256 pnlSmallest,
        uint256 asOf,
        uint32 elapsedDays,
        uint32 tenorDays
    );
}
