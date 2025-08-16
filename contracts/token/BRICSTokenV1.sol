// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "../tranche/TrancheControllerV1.sol";

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
    
    // ============ Roles ============
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER");
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER");
    bytes32 public constant NAV_UPDATER_ROLE = keccak256("NAV_UPDATER");
    
    // ============ Events ============
    
    event SharePriceAccrued(uint256 deltaPps, uint256 newSharePrice);
    event ControllerSet(address indexed controller);
    
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
        
        sharePrice = 1e18; // Initial share price = 1.0
        controller = address(0);
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
     * @notice Set controller address (admin only)
     * @param _controller New controller address
     */
    function setController(address _controller) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_controller == address(0)) revert ZeroAddress();
        
        controller = _controller;
        emit ControllerSet(_controller);
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
}
