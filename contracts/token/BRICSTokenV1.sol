// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "../tranche/TrancheControllerV1.sol";
import "../sovereign/SovereignBufferControllerV1.sol";
import "../mezz/MezzSink.sol";

interface IRedemptionQueueV1Like {
    function instantPerTxLimitView() external view returns (uint256);
    function instantRemainingToday() external view returns (uint256);
    function redeemSmallAfterBurn(address user, uint256 amount) external;
    function enqueueAfterBurn(address user, uint256 amount, uint256 strikeTs) external;
    function nextMonthStrikeTs(uint256 ts) external pure returns (uint256);
}

/**
 * @title BRICSTokenV1
 * @dev ERC-20 token with NAV tracking via sharePrice
 * @notice Super-senior token with upgrade-safe storage layout
 * @author BRICS Protocol
 */
contract BRICSTokenV1 is ERC20, AccessControl {
    // ============ Storage ============
    
    /// @notice Internal share price (1e18 scale)
    uint256 public sharePrice;
    
    /// @notice Controller address that can mint/burn
    address public controller;
    
    /// @notice Redemption queue address
    address public redemptionQueue;
    
    /// @notice Sovereign buffer controller address
    address public sovereignBufferController;
    
    /// @notice Mezz sink address
    address public mezzSink;
    
    /// @notice Protocol fee in basis points (default 50 = 0.5%)
    uint16 public protocolFeeBps;
    
    /// @notice Mezz share in basis points (default 0 = 0%)
    uint16 public mezzShareBps;
    
    // ============ Roles ============
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER");
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER");
    bytes32 public constant NAV_UPDATER_ROLE = keccak256("NAV_UPDATER");
    bytes32 public constant REDEMPTION_ADMIN_ROLE = keccak256("REDEMPTION_ADMIN");
    
    // ============ Events ============
    
    event SharePriceAccrued(uint256 deltaPps, uint256 newSharePrice);
    event ControllerSet(address indexed controller);
    event RedemptionQueueSet(address indexed queue);
    event PremiumAccrued(uint256 gross, uint256 fee, uint256 toBuffer, uint256 toMezz, uint256 toTokenNav);
    event ProtocolFeeSet(uint256 feeBps);
    event MezzShareSet(uint256 shareBps);
    
    // ============ Errors ============
    
    error OnlyController();
    error OnlyNAVUpdater();
    error InvalidAmount();
    error ZeroAddress();
    
    // ============ Constructor ============
    
    constructor() ERC20("BRICS Super-Senior", "BRICS") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(CONTROLLER_ROLE, msg.sender);
        _grantRole(NAV_UPDATER_ROLE, msg.sender);
        _grantRole(REDEMPTION_ADMIN_ROLE, msg.sender);
        
        sharePrice = 1e18; // Initial share price = 1.0
        controller = address(0);
        protocolFeeBps = 50; // 0.5% default
        mezzShareBps = 0; // 0% default
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Mint tokens to an address (controller only)
     * @param to Recipient address
     * @param shares Number of shares to mint
     */
    function mintTo(address to, uint256 shares) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (shares == 0) revert InvalidAmount();
        
        // Check controller cap if controller is set
        if (controller != address(0)) {
            uint256 sharePriceRay = sharePrice * 1e9; // Convert to RAY format
            uint256 maxMintable = TrancheControllerV1(controller).maxMintable(totalSupply(), sharePriceRay);
            if (shares > maxMintable) revert InvalidAmount();
            
            // Record the mint
            TrancheControllerV1(controller).recordMint(shares);
        }
        
        _mint(to, shares);
    }
    
    /**
     * @notice Burn tokens from an address (controller only)
     * @param from Address to burn from
     * @param shares Number of shares to burn
     */
    function burnFrom(address from, uint256 shares) external onlyRole(BURNER_ROLE) {
        if (from == address(0)) revert ZeroAddress();
        if (shares == 0) revert InvalidAmount();
        
        _burn(from, shares);
    }
    
    /**
     * @notice Accrue NAV to increase share price (NAV updater only)
     * @param deltaPps NAV increase in 1e18 terms
     */
    function accrue(uint256 deltaPps) external onlyRole(NAV_UPDATER_ROLE) {
        if (deltaPps == 0) revert InvalidAmount();
        
        uint256 newSharePrice = sharePrice + deltaPps;
        sharePrice = newSharePrice;
        
        emit SharePriceAccrued(deltaPps, newSharePrice);
    }
    
    /**
     * @notice Accrue premium with waterfall distribution (NAV updater only)
     * @param grossPremium Gross premium amount in base units
     */
    function accruePremium(uint256 grossPremium) external onlyRole(NAV_UPDATER_ROLE) {
        if (grossPremium == 0) revert InvalidAmount();
        
        _applyWaterfall(grossPremium);
    }
    
    /**
     * @notice Set controller address (admin only)
     * @param _controller New controller address
     */
    function setController(address _controller) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_controller == address(0)) revert ZeroAddress();
        
        controller = _controller;
        emit ControllerSet(_controller);
    }
    
    /**
     * @notice Set redemption queue address (redemption admin only)
     * @param _queue Redemption queue address
     */
    function setRedemptionQueue(address _queue) external onlyRole(REDEMPTION_ADMIN_ROLE) {
        if (_queue == address(0)) revert ZeroAddress();
        
        redemptionQueue = _queue;
        emit RedemptionQueueSet(_queue);
    }
    
    /**
     * @notice Set sovereign buffer controller address (admin only)
     * @param _controller Buffer controller address
     */
    function setSovereignBufferController(address _controller) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_controller == address(0)) revert ZeroAddress();
        
        sovereignBufferController = _controller;
    }
    
    /**
     * @notice Set mezz sink address (admin only)
     * @param _sink Mezz sink address
     */
    function setMezzSink(address _sink) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_sink == address(0)) revert ZeroAddress();
        
        mezzSink = _sink;
    }
    
    /**
     * @notice Set protocol fee in basis points (admin only)
     * @param feeBps Fee in basis points
     */
    function setProtocolFeeBps(uint16 feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (feeBps > 10000) revert InvalidAmount();
        
        protocolFeeBps = feeBps;
        emit ProtocolFeeSet(feeBps);
    }
    
    /**
     * @notice Set mezz share in basis points (admin only)
     * @param shareBps Share in basis points
     */
    function setMezzShareBps(uint16 shareBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (shareBps > 10000) revert InvalidAmount();
        
        mezzShareBps = shareBps;
        emit MezzShareSet(shareBps);
    }
    
    /**
     * @notice Redeem tokens (routes to instant or windowed queue)
     * @param amount Amount to redeem
     */
    function redeem(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        if (redemptionQueue == address(0)) revert ZeroAddress();
        
        address user = msg.sender;
        
        // Burn first (supply of $BRICS always reflects post-redeem)
        _burn(user, amount);
        
        IRedemptionQueueV1Like q = IRedemptionQueueV1Like(redemptionQueue);
        uint256 perTx = q.instantPerTxLimitView();
        uint256 remaining = q.instantRemainingToday();
        
        if (perTx > 0 && amount <= perTx && amount <= remaining) {
            // instant lane
            q.redeemSmallAfterBurn(user, amount);
        } else {
            // monthly window
            uint256 strike = q.nextMonthStrikeTs(block.timestamp);
            q.enqueueAfterBurn(user, amount, strike);
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get total assets (totalSupply * sharePrice / 1e18)
     * @return Total assets in base units
     */
    function totalAssets() external view returns (uint256) {
        return (totalSupply() * sharePrice) / 1e18;
    }
    
    /**
     * @notice Get current price per share
     * @return Share price in 1e18 terms
     */
    function pricePerShare() external view returns (uint256) {
        return sharePrice;
    }
    
    /**
     * @notice Preview mint amount for given assets
     * @param assets Amount of assets to convert
     * @return Shares that would be minted
     */
    function previewMint(uint256 assets) external view returns (uint256) {
        if (sharePrice == 0) return 0;
        return (assets * 1e18) / sharePrice;
    }
    
    /**
     * @notice Preview assets for given shares
     * @param shares Number of shares to convert
     * @return Assets that would be received
     */
    function previewRedeem(uint256 shares) external view returns (uint256) {
        return (shares * sharePrice) / 1e18;
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Apply waterfall distribution to gross premium
     * @param grossPremium Gross premium amount in base units
     */
    function _applyWaterfall(uint256 grossPremium) internal {
        uint256 remaining = grossPremium;
        
        // 1. Protocol fee (fee first)
        uint256 fee = (grossPremium * protocolFeeBps) / 10000;
        remaining -= fee;
        
        // 2. Buffer top-up (capped to target)
        uint256 toBuffer = 0;
        if (sovereignBufferController != address(0)) {
            uint256 totalAssets = this.totalAssets();
            uint256 shortfall = SovereignBufferControllerV1(sovereignBufferController).bufferShortfall(totalAssets);
            
            // Check if suppression occurred and emit event
            SovereignBufferControllerV1(sovereignBufferController).checkAndEmitSuppression(totalAssets);
            
            toBuffer = shortfall < remaining ? shortfall : remaining;
            remaining -= toBuffer;
            
            if (toBuffer > 0) {
                SovereignBufferControllerV1(sovereignBufferController).recordTopUp(toBuffer);
            }
        }
        
        // 3. Mezz allocation (if configured)
        uint256 toMezz = 0;
        if (mezzSink != address(0) && mezzShareBps > 0 && remaining > 0) {
            toMezz = (remaining * mezzShareBps) / 10000;
            remaining -= toMezz;
            
            if (toMezz > 0) {
                MezzSink(mezzSink).credit(toMezz);
            }
        }
        
        // 4. Remainder to token NAV
        uint256 toTokenNav = remaining;
        if (toTokenNav > 0) {
            uint256 newSharePrice = sharePrice + toTokenNav;
            sharePrice = newSharePrice;
        }
        
        emit PremiumAccrued(grossPremium, fee, toBuffer, toMezz, toTokenNav);
    }
}
