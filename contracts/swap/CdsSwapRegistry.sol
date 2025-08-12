// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ICdsSwap.sol";

/**
 * @title CdsSwapRegistry
 * @notice Registry for storing CDS swap metadata and status
 * @dev Minimal storage contract for swap state management
 */
contract CdsSwapRegistry {
    /**
     * @notice Swap status enumeration
     */
    enum SwapStatus {
        Proposed,
        Active,
        Settled,
        Cancelled
    }

    /**
     * @notice Swap metadata structure
     */
    struct SwapMetadata {
        ICdsSwap.SwapParams params;
        SwapStatus status;
        address proposer;
        uint64 createdAt;
    }

    /**
     * @notice Mapping from swapId to swap metadata
     */
    mapping(bytes32 => SwapMetadata) public swaps;

    /**
     * @notice Get swap metadata
     * @param swapId Unique identifier for the swap
     * @return metadata Swap metadata
     */
    function getSwap(bytes32 swapId) external view returns (SwapMetadata memory metadata) {
        return swaps[swapId];
    }

    /**
     * @notice Get swap status
     * @param swapId Unique identifier for the swap
     * @return status Current status of the swap
     */
    function getSwapStatus(bytes32 swapId) external view returns (SwapStatus status) {
        return swaps[swapId].status;
    }

    /**
     * @notice Check if swap exists
     * @param swapId Unique identifier for the swap
     * @return exists True if swap exists
     */
    function swapExists(bytes32 swapId) external view returns (bool exists) {
        return swaps[swapId].proposer != address(0);
    }

    /**
     * @notice Internal function to create swap metadata
     * @param swapId Unique identifier for the swap
     * @param params Swap parameters
     * @param proposer Address of the proposer
     */
    function _createSwap(
        bytes32 swapId,
        ICdsSwap.SwapParams memory params,
        address proposer
    ) internal {
        require(swaps[swapId].proposer == address(0), "Swap already exists");
        
        swaps[swapId] = SwapMetadata({
            params: params,
            status: SwapStatus.Proposed,
            proposer: proposer,
            createdAt: uint64(block.timestamp)
        });
    }

    /**
     * @notice Internal function to update swap status
     * @param swapId Unique identifier for the swap
     * @param newStatus New status to set
     */
    function _updateSwapStatus(bytes32 swapId, SwapStatus newStatus) internal {
        require(swaps[swapId].proposer != address(0), "Swap does not exist");
        swaps[swapId].status = newStatus;
    }
}
