// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ICdsSwapEvents
 * @notice Events for Credit Default Swap (CDS) operations
 * @dev Defines all events emitted by CDS swap contracts
 */
interface ICdsSwapEvents {
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
}
