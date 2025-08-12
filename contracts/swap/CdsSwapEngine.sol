// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICdsSwap.sol";
import "./ICdsSwapEvents.sol";
import "./CdsSwapRegistry.sol";
import "./IPriceOracleAdapter.sol";
import "../libraries/RiskSignalLib.sol";

/**
 * @title CdsSwapEngine
 * @notice Engine for Credit Default Swap (CDS) operations
 * @dev RBAC-gated operations with parameter validation stubs
 */
contract CdsSwapEngine is ICdsSwap, ICdsSwapEvents, CdsSwapRegistry, AccessControl {
    using Strings for uint256;
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant GOV_ROLE = keccak256("GOV_ROLE");
    bytes32 public constant BROKER_ROLE = keccak256("BROKER_ROLE");

    // Errors
    error Unauthorized();
    error InvalidParams(string reason);
    error NotFound(bytes32 swapId);

    // Price oracle adapter
    IPriceOracleAdapter public priceOracle;

    // Quote validation constants
    uint16 public constant MIN_SPREAD_BPS = 1; // 0.01%
    uint16 public constant MAX_SPREAD_BPS = 10000; // 100%
    uint16 public constant MIN_CORRELATION_BPS = 1000; // 10%
    uint16 public constant MAX_CORRELATION_BPS = 9000; // 90%
    uint64 public constant QUOTE_STALE_SECONDS = 300; // 5 minutes

    // Settlement configuration
    IERC20 public settlementToken;
    ICdsSwapEvents.SettlementMode public settlementMode;



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
     * @notice Settle a CDS swap with price quote
     * @param swapId Unique identifier of the swap to settle
     * @param quote Price quote for settlement
     */
    function settleSwap(bytes32 swapId, PriceQuote calldata quote) external override {
        SwapMetadata storage swap = swaps[swapId];
        if (swap.proposer == address(0)) {
            revert NotFound(swapId);
        }

        if (swap.status != SwapStatus.Active) {
            revert InvalidParams("Swap not in active status");
        }

        // Verify quote signature
        if (!verifyQuote(quote, swap.params.portfolioId)) {
            revert InvalidParams("Invalid quote signature");
        }

        // Calculate P&L
        int256 payout = _calculatePayout(swap, quote);

        // Execute settlement transfer if token is configured
        if (address(settlementToken) != address(0)) {
            address buyer = swap.params.protectionBuyer.counterparty;
            address seller = swap.params.protectionSeller.counterparty;
            
            if (payout > 0) {
                // Seller pays buyer
                _settlementTransfer(swapId, seller, buyer, uint256(payout));
            } else if (payout < 0) {
                // Buyer pays seller
                _settlementTransfer(swapId, buyer, seller, uint256(-payout));
            }
        }

        // Update status
        _updateSwapStatus(swapId, SwapStatus.Settled);

        // Emit event with calculated P&L
        emit SwapSettled(swapId, msg.sender, payout);
    }

    /**
     * @notice Calculate payout for swap settlement
     * @param swap Swap metadata
     * @param quote Price quote
     * @return payout Calculated payout amount
     */
    function _calculatePayout(SwapMetadata storage swap, PriceQuote calldata quote) internal view returns (int256 payout) {
        // Calculate spread difference in basis points
        int256 pnlBps = int256(uint256(quote.fairSpreadBps)) - int256(uint256(swap.params.protectionBuyer.spreadBps));
        
        // Calculate notional in basis points (divide by 1e4)
        int256 notionalBps = int256(swap.params.protectionBuyer.notional) / 10000;
        
        // Calculate elapsed days
        uint64 currentTime = uint64(block.timestamp);
        uint64 startTime = swap.params.protectionBuyer.start;
        uint64 endTime = swap.params.protectionBuyer.maturity;
        
        // Guard against future start
        if (currentTime < startTime) {
            revert InvalidParams("Swap has not started yet");
        }
        
        // Calculate elapsed days (min of current time and end time)
        uint64 effectiveEndTime = currentTime < endTime ? currentTime : endTime;
        uint64 elapsedDays = (effectiveEndTime - startTime) / 86400; // Convert seconds to days
        
        // Calculate tenor days
        uint64 tenorDays = (endTime - startTime) / 86400;
        
        if (tenorDays == 0) {
            revert InvalidParams("Invalid tenor");
        }
        
        // Calculate payout: pnlBps * notionalBps * elapsedDays / tenorDays
        payout = (pnlBps * notionalBps * int256(uint256(elapsedDays))) / int256(uint256(tenorDays));
        
        // Clamp to int256 bounds (this is handled automatically by Solidity)
        return payout;
    }

    /**
     * @notice Execute settlement transfer
     * @param swapId Swap identifier
     * @param payer Address of the payer
     * @param payee Address of the payee
     * @param amount Amount to transfer
     */
    function _settlementTransfer(
        bytes32 swapId,
        address payer,
        address payee,
        uint256 amount
    ) internal {
        if (amount == 0) return;

        if (settlementMode == ICdsSwapEvents.SettlementMode.TRANSFERS) {
            // Requires allowances set by both parties to this engine
            settlementToken.safeTransferFrom(payer, payee, amount);
            emit SettlementPaid(swapId, payer, payee, amount);
        } else {
            // ACCOUNTING: record only
            emit SettlementPaid(swapId, payer, payee, amount);
        }
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
     * @notice Set price oracle adapter (GOV_ROLE only)
     * @param _priceOracle Address of the price oracle adapter
     */
    function setPriceOracle(address _priceOracle) external {
        if (!hasRole(GOV_ROLE, msg.sender)) {
            revert Unauthorized();
        }
        
        if (_priceOracle == address(0)) {
            revert InvalidParams("Price oracle cannot be zero address");
        }
        
        priceOracle = IPriceOracleAdapter(_priceOracle);
        
        emit PriceOracleSet(_priceOracle);
    }

    /**
     * @notice Set the settlement token (GOV_ROLE only)
     * @param token Address of the settlement token
     */
    function setSettlementToken(address token) external {
        if (!hasRole(GOV_ROLE, msg.sender)) {
            revert Unauthorized();
        }
        if (token == address(0)) {
            revert InvalidParams("Settlement token cannot be zero address");
        }
        settlementToken = IERC20(token);
        emit SettlementTokenSet(token);
    }

    /**
     * @notice Set the settlement mode (GOV_ROLE only)
     * @param mode New settlement mode
     */
    function setSettlementMode(ICdsSwapEvents.SettlementMode mode) external {
        if (!hasRole(GOV_ROLE, msg.sender)) {
            revert Unauthorized();
        }
        settlementMode = mode;
        emit SettlementModeSet(mode);
    }

    /**
     * @notice Verify price quote signature
     * @param quote Price quote to verify
     * @param portfolioId Portfolio identifier
     * @return isValid True if quote is valid
     */
    function verifyQuote(PriceQuote calldata quote, bytes32 portfolioId) public view returns (bool isValid) {
        // Check if price oracle is set
        if (address(priceOracle) == address(0)) {
            return false;
        }

        // Validate quote parameters
        if (quote.fairSpreadBps < MIN_SPREAD_BPS || quote.fairSpreadBps > MAX_SPREAD_BPS) {
            return false;
        }

        if (quote.correlationBps < MIN_CORRELATION_BPS || quote.correlationBps > MAX_CORRELATION_BPS) {
            return false;
        }

        // Check if quote is stale
        if (block.timestamp > quote.asOf + QUOTE_STALE_SECONDS) {
            return false;
        }

        // Reconstruct the payload that was signed using quote fields
        // Order: (bytes32 portfolioId, uint64 asOf, uint256 riskScore, uint16 correlationBps, uint16 spreadBps, bytes32 modelIdHash, bytes32 featuresHash)
        RiskSignalLib.Payload memory payload = RiskSignalLib.Payload({
            portfolioId: portfolioId,
            asOf: quote.asOf,
            riskScore: quote.riskScore,
            correlationBps: quote.correlationBps,
            spreadBps: quote.fairSpreadBps,
            modelIdHash: quote.modelIdHash,
            featuresHash: quote.featuresHash
        });

        // Recover signer from signature
        address recoveredSigner = RiskSignalLib.recoverSigner(payload, quote.signature);

        // Compare with expected risk oracle
        return recoveredSigner == priceOracle.riskOracle();
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
