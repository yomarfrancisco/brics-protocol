// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "../token/BRICSTokenV1.sol";

/**
 * @title TrancheControllerV1
 * @dev Adaptive tranching controller with configurable attachment/detachment
 * @notice Manages super-senior token issuance, caps, and protection modes
 * @author BRICS Protocol
 */
contract TrancheControllerV1 is AccessControl {
    // ============ Storage ============
    
    /// @notice BRICSTokenV1 contract
    BRICSTokenV1 public token;
    
    /// @notice Super-senior attachment point (basis points, default 10000 = 100.00%)
    uint16 public ssAttachBps;
    
    /// @notice Super-senior detachment target (basis points, default 10200 = 102.00%)
    uint16 public ssDetachBps;
    
    /// @notice Maximum super-senior shares outstanding
    uint256 public superSeniorCap;
    
    /// @notice Stress threshold in basis points (default 8000 = 80.00%)
    uint16 public stressThresholdBps;
    
    /// @notice Whether system is in stress mode
    bool public stress;
    
    /// @notice Whether issuance is locked
    bool public issuanceLocked;
    
    /// @notice Sovereign buffer adapter address
    address public sovereignBuffer;
    
    /// @notice Optional privileged engine address
    address public engine;
    
    // ============ Roles ============
    
    bytes32 public constant ENGINE_ROLE = keccak256("ENGINE");
    
    // ============ Constants ============
    
    uint16 public constant MIN_DETACHMENT_BPS = 10200; // 102.00%
    uint16 public constant MAX_DETACHMENT_BPS = 10500; // 105.00%
    
    // ============ Events ============
    
    event DetachmentTargetSet(uint16 bps);
    event CapAdjusted(uint256 newCap);
    event IssuanceLocked();
    event IssuanceUnlocked();
    event SovereignBufferSet(address indexed buffer);
    event ProtectionModeEntered(string reason);
    event EngineSet(address indexed engine);
    event TrancheResized(uint256 newCap, bool stress);
    event StressSet(bool stress);
    
    // ============ Errors ============
    
    error OnlyOwnerOrEngine();
    error IssuanceLockedError();
    error CapExceeded();
    error InvalidDetachmentTarget();
    error ZeroAddress();
    error InvalidAmount();
    
    // ============ Modifiers ============
    
    modifier onlyOwnerOrEngine() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(ENGINE_ROLE, msg.sender)) {
            revert OnlyOwnerOrEngine();
        }
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _token) {
        if (_token == address(0)) revert ZeroAddress();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ENGINE_ROLE, msg.sender);
        
        token = BRICSTokenV1(_token);
        ssAttachBps = 10000; // 100.00%
        ssDetachBps = 10200; // 102.00%
        stressThresholdBps = 8000; // 80.00%
        stress = false;
        issuanceLocked = false;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Set detachment target (admin only)
     * @param bps Detachment target in basis points [10200..10500]
     */
    function setDetachmentTarget(uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bps < MIN_DETACHMENT_BPS || bps > MAX_DETACHMENT_BPS) {
            revert InvalidDetachmentTarget();
        }
        
        ssDetachBps = bps;
        emit DetachmentTargetSet(bps);
    }
    
    /**
     * @notice Adjust super-senior cap (admin only)
     * @param newCap New cap in shares
     */
    function adjustSuperSeniorCap(uint256 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newCap == 0) revert InvalidAmount();
        
        superSeniorCap = newCap;
        emit CapAdjusted(newCap);
    }
    
    /**
     * @notice Set caps and stress threshold (admin only)
     * @param newCap New cap in shares
     * @param newStressThresholdBps New stress threshold in basis points
     */
    function setCaps(uint256 newCap, uint16 newStressThresholdBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newCap == 0) revert InvalidAmount();
        if (newStressThresholdBps > 10000) revert InvalidAmount();
        
        superSeniorCap = newCap;
        stressThresholdBps = newStressThresholdBps;
        emit TrancheResized(newCap, stress);
    }
    
    /**
     * @notice Set stress flag (admin only)
     * @param _stress New stress state
     */
    function setStressFlag(bool _stress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        stress = _stress;
        emit StressSet(_stress);
    }
    
    /**
     * @notice Lock issuance (admin only)
     */
    function lockIssuance() external onlyRole(DEFAULT_ADMIN_ROLE) {
        issuanceLocked = true;
        emit IssuanceLocked();
    }
    
    /**
     * @notice Unlock issuance (admin only)
     */
    function unlockIssuance() external onlyRole(DEFAULT_ADMIN_ROLE) {
        issuanceLocked = false;
        emit IssuanceUnlocked();
    }
    
    /**
     * @notice Set sovereign buffer adapter (admin only)
     * @param _buffer Buffer adapter address
     */
    function setSovereignBuffer(address _buffer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        sovereignBuffer = _buffer;
        emit SovereignBufferSet(_buffer);
    }
    
    /**
     * @notice Set engine address (admin only)
     * @param _engine Engine address
     */
    function setEngine(address _engine) external onlyRole(DEFAULT_ADMIN_ROLE) {
        engine = _engine;
        if (_engine != address(0)) {
            _grantRole(ENGINE_ROLE, _engine);
        }
        emit EngineSet(_engine);
    }
    
    /**
     * @notice Report protection mode (admin only)
     * @param reason Protection mode reason
     */
    function reportProtectionMode(string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit ProtectionModeEntered(reason);
    }
    
    /**
     * @notice Mint tokens (admin/engine only)
     * @param to Recipient address
     * @param shares Number of shares to mint
     */
    function mint(address to, uint256 shares) external onlyOwnerOrEngine {
        if (issuanceLocked) revert IssuanceLockedError();
        if (to == address(0)) revert ZeroAddress();
        if (shares == 0) revert InvalidAmount();
        if (token.totalSupply() + shares > superSeniorCap) revert CapExceeded();
        
        token.mintTo(to, shares);
    }
    
    /**
     * @notice Burn tokens (admin/engine only)
     * @param from Address to burn from
     * @param shares Number of shares to burn
     */
    function burn(address from, uint256 shares) external onlyOwnerOrEngine {
        if (from == address(0)) revert ZeroAddress();
        if (shares == 0) revert InvalidAmount();
        
        token.burnFrom(from, shares);
    }
    
    /**
     * @notice Record a mint operation (called by token)
     * @param amount Amount minted
     */
    function recordMint(uint256 amount) external {
        // Only token can call this
        if (msg.sender != address(token)) revert OnlyOwnerOrEngine();
        // Bookkeeping only for MVP - could add more logic here
    }
    
    /**
     * @notice Record a redemption request (called by token)
     * @param amount Amount requested for redemption
     */
    function recordRedemptionRequest(uint256 amount) external {
        // Only token can call this
        if (msg.sender != address(token)) revert OnlyOwnerOrEngine();
        // Bookkeeping only for MVP - could add more logic here
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current attachment point
     * @return Attachment point in basis points
     */
    function getAttachmentPoint() external view returns (uint16) {
        return ssAttachBps;
    }
    
    /**
     * @notice Get current detachment target
     * @return Detachment target in basis points
     */
    function getDetachmentTarget() external view returns (uint16) {
        return ssDetachBps;
    }
    
    /**
     * @notice Check if issuance is allowed
     * @return True if issuance is not locked
     */
    function canIssue() external view returns (bool) {
        return !issuanceLocked;
    }
    
    /**
     * @notice Get remaining issuance capacity
     * @return Remaining shares that can be issued
     */
    function getRemainingCapacity() external view returns (uint256) {
        if (issuanceLocked) return 0;
        if (token.totalSupply() >= superSeniorCap) return 0;
        return superSeniorCap - token.totalSupply();
    }
    
    /**
     * @notice Get maximum mintable amount given current supply and share price
     * @param totalSupply Current total supply
     * @param sharePriceRay Share price in RAY (1e27)
     * @return Maximum amount that can be minted
     */
    function maxMintable(uint256 totalSupply, uint256 sharePriceRay) external view returns (uint256) {
        if (issuanceLocked) return 0;
        if (totalSupply >= superSeniorCap) return 0;
        
        uint256 remaining = superSeniorCap - totalSupply;
        
        // In stress mode, reduce capacity
        if (stress) {
            remaining = (remaining * stressThresholdBps) / 10000;
        }
        
        return remaining;
    }
    
    /**
     * @notice Check if system is in stress mode
     * @return True if stress mode is active
     */
    function isStress() external view returns (bool) {
        return stress;
    }
}
