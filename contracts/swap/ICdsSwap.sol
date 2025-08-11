// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ICdsSwap
 * @notice Interface for Credit Default Swap (CDS) operations
 * @dev Defines the core structures and functions for CDS swap management
 */
interface ICdsSwap {
    /**
     * @notice Represents a single leg of a CDS swap
     * @param counterparty Address of the counterparty for this leg
     * @param notional Notional amount in base units (e.g., USDC decimals)
     * @param spreadBps Spread in basis points (1/10000)
     * @param start Start timestamp of the swap
     * @param maturity Maturity timestamp of the swap
     */
    struct Leg {
        address counterparty;
        uint256 notional;
        uint16 spreadBps;
        uint64 start;
        uint64 maturity;
    }

    /**
     * @notice Parameters for creating a new CDS swap
     * @param portfolioId Unique identifier for the portfolio
     * @param protectionBuyer Leg for the protection buyer
     * @param protectionSeller Leg for the protection seller
     * @param correlationBps Correlation factor in basis points (1/10000)
     */
    struct SwapParams {
        bytes32 portfolioId;
        Leg protectionBuyer;
        Leg protectionSeller;
        uint16 correlationBps;
    }

    /**
     * @notice Propose a new CDS swap
     * @param params Swap parameters
     * @return swapId Unique identifier for the proposed swap
     */
    function proposeSwap(SwapParams calldata params) external returns (bytes32 swapId);

    /**
     * @notice Activate a proposed CDS swap
     * @param swapId Unique identifier of the swap to activate
     */
    function activateSwap(bytes32 swapId) external;

    /**
     * @notice Cancel a CDS swap (before activation)
     * @param swapId Unique identifier of the swap to cancel
     */
    function cancelSwap(bytes32 swapId) external;

    /**
     * @notice Settle a CDS swap (stub for future implementation)
     * @param swapId Unique identifier of the swap to settle
     */
    function settleSwap(bytes32 swapId) external;
}
