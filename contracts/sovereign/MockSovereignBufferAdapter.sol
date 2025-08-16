// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "./ISovereignBuffer.sol";

/**
 * @title MockSovereignBufferAdapter
 * @dev Mock implementation of ISovereignBuffer for testing
 * @notice Provides mock sovereign buffer functionality with access control
 * @author BRICS Protocol
 */
contract MockSovereignBufferAdapter is ISovereignBuffer, AccessControl {
    // ============ Storage ============
    
    /// @notice Last reported utilization in basis points
    uint16 public lastUtilizationBps;
    
    /// @notice Total top-up amount requested
    uint256 public totalTopUpRequested;
    
    /// @notice Role for allowlisted addresses
    bytes32 public constant ALLOWLIST_ROLE = keccak256("ALLOWLIST_ROLE");
    
    // ============ Errors ============
    
    error NotAuthorized();
    error InvalidUtilization();
    error InvalidAmount();
    
    // ============ Constructor ============
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ALLOWLIST_ROLE, msg.sender);
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Report utilization (admin or allowlisted only)
     * @param bps Utilization in basis points (0-10000)
     */
    function reportUtilization(uint16 bps) external override {
        if (!hasRole(ALLOWLIST_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized();
        }
        if (bps > 10000) revert InvalidUtilization();
        
        lastUtilizationBps = bps;
        emit UtilizationReported(bps);
    }
    
    /**
     * @notice Request top-up (admin or allowlisted only)
     * @param amount Amount to request
     */
    function requestTopUp(uint256 amount) external override {
        if (!hasRole(ALLOWLIST_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized();
        }
        if (amount == 0) revert InvalidAmount();
        
        totalTopUpRequested += amount;
        emit TopUpRequested(amount);
    }
    
    /**
     * @notice Set allowlist status for an address (admin only)
     * @param account Address to set
     * @param allowed Whether to allow
     */
    function setAllowlist(address account, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (allowed) {
            _grantRole(ALLOWLIST_ROLE, account);
        } else {
            _revokeRole(ALLOWLIST_ROLE, account);
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Check if address is allowlisted
     * @param account Address to check
     * @return True if allowlisted
     */
    function isAllowlisted(address account) external view returns (bool) {
        return hasRole(ALLOWLIST_ROLE, account);
    }
    
    /**
     * @notice Get current utilization percentage
     * @return Utilization as percentage (0-100)
     */
    function getUtilizationPercentage() external view returns (uint16) {
        return lastUtilizationBps / 100; // Convert bps to percentage
    }
}
