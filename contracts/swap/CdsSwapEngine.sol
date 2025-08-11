// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./ICdsSwap.sol";
import "./ICdsSwapEvents.sol";
import "./CdsSwapRegistry.sol";

/**
 * @title CdsSwapEngine
 * @notice Engine for Credit Default Swap (CDS) operations
 * @dev RBAC-gated operations with parameter validation stubs
 */
contract CdsSwapEngine is ICdsSwap, ICdsSwapEvents, CdsSwapRegistry, AccessControl {
    using Strings for uint256;

    // Roles
    bytes32 public constant GOV_ROLE = keccak256("GOV_ROLE");
    bytes32 public constant BROKER_ROLE = keccak256("BROKER_ROLE");

    // Errors
    error Unauthorized();
    error InvalidParams(string reason);
    error NotFound(bytes32 swapId);

    /**
     * @notice Constructor
     * @param admin Initial admin address
     */
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOV_ROLE, admin);
    }

    /**
     * @notice Propose a new CDS swap
     * @param params Swap parameters
     * @return swapId Unique identifier for the proposed swap
     */
    function proposeSwap(SwapParams calldata params) external override returns (bytes32 swapId) {
        // Validate parameters
        _validateSwapParams(params);

        // Generate swap ID
        swapId = _generateSwapId(params, msg.sender);

        // Create swap metadata
        _createSwap(swapId, params, msg.sender);

        // Emit event
        emit SwapProposed(
            swapId,
            params.portfolioId,
            msg.sender,
            params.protectionBuyer.counterparty,
            params.protectionSeller.counterparty,
            params.protectionBuyer.notional,
            params.protectionBuyer.spreadBps,
            params.protectionBuyer.start,
            params.protectionBuyer.maturity,
            params.correlationBps
        );
    }

    /**
     * @notice Activate a proposed CDS swap (BROKER_ROLE only)
     * @param swapId Unique identifier of the swap to activate
     */
    function activateSwap(bytes32 swapId) external override {
        if (!hasRole(BROKER_ROLE, msg.sender)) {
            revert Unauthorized();
        }

        SwapMetadata storage swap = swaps[swapId];
        if (swap.proposer == address(0)) {
            revert NotFound(swapId);
        }

        if (swap.status != SwapStatus.Proposed) {
            revert InvalidParams("Swap not in proposed status");
        }

        // Update status
        _updateSwapStatus(swapId, SwapStatus.Active);

        // Emit event
        emit SwapActivated(swapId, msg.sender);
    }

    /**
     * @notice Cancel a CDS swap (GOV_ROLE or proposer before activation)
     * @param swapId Unique identifier of the swap to cancel
     */
    function cancelSwap(bytes32 swapId) external override {
        SwapMetadata storage swap = swaps[swapId];
        if (swap.proposer == address(0)) {
            revert NotFound(swapId);
        }

        // Check permissions: GOV_ROLE or proposer (before activation)
        bool isGov = hasRole(GOV_ROLE, msg.sender);
        bool isProposer = msg.sender == swap.proposer;
        bool isProposed = swap.status == SwapStatus.Proposed;

        if (!isGov && !(isProposer && isProposed)) {
            revert Unauthorized();
        }

        // Update status
        _updateSwapStatus(swapId, SwapStatus.Cancelled);

        // Emit event
        emit SwapCancelled(swapId, msg.sender, "");
    }

    /**
     * @notice Settle a CDS swap (stub for future implementation)
     * @param swapId Unique identifier of the swap to settle
     */
    function settleSwap(bytes32 swapId) external override {
        SwapMetadata storage swap = swaps[swapId];
        if (swap.proposer == address(0)) {
            revert NotFound(swapId);
        }

        if (swap.status != SwapStatus.Active) {
            revert InvalidParams("Swap not in active status");
        }

        // TODO: Phase 1.5 - Implement settlement logic with Pricing Service
        // For now, just update status and emit with placeholder P&L
        _updateSwapStatus(swapId, SwapStatus.Settled);

        // Emit event with placeholder P&L (0 for now)
        emit SwapSettled(swapId, msg.sender, 0);
    }

    /**
     * @notice Validate swap parameters
     * @param params Swap parameters to validate
     */
    function _validateSwapParams(SwapParams calldata params) internal view {
        // Basic validation
        if (params.portfolioId == bytes32(0)) {
            revert InvalidParams("Invalid portfolio ID");
        }

        if (params.protectionBuyer.counterparty == address(0)) {
            revert InvalidParams("Invalid protection buyer");
        }

        if (params.protectionSeller.counterparty == address(0)) {
            revert InvalidParams("Invalid protection seller");
        }

        if (params.protectionBuyer.notional == 0) {
            revert InvalidParams("Invalid notional amount");
        }

        if (params.protectionBuyer.start >= params.protectionBuyer.maturity) {
            revert InvalidParams("Invalid start/maturity dates");
        }

        if (params.protectionBuyer.start < block.timestamp) {
            revert InvalidParams("Start time must be in the future");
        }

        // TODO: Phase 1.5 - Add more sophisticated validation
        // - Spread bounds checking
        // - Correlation factor validation
        // - Portfolio existence verification
    }

    /**
     * @notice Generate swap ID
     * @param params Swap parameters
     * @param proposer Address of the proposer
     * @return swapId Generated swap ID
     */
    function _generateSwapId(SwapParams calldata params, address proposer) internal view returns (bytes32 swapId) {
        return keccak256(
            abi.encodePacked(
                params.portfolioId,
                params.protectionBuyer.counterparty,
                params.protectionSeller.counterparty,
                params.protectionBuyer.notional,
                params.protectionBuyer.spreadBps,
                params.protectionBuyer.start,
                params.protectionBuyer.maturity,
                params.correlationBps,
                proposer,
                block.timestamp
            )
        );
    }

    /**
     * @notice Check if contract supports interface
     * @param interfaceId Interface identifier
     * @return True if supported
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
