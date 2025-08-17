// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MezzSink
 * @dev Placeholder contract to capture mezz allocations for invariants & accounting
 * @notice Holds balances via credit(uint256); view totalCredited(). No withdrawals for MVP.
 * @author BRICS Protocol
 */
contract MezzSink is AccessControl {
    // ============ Storage ============
    
    /// @notice Total amount credited to mezz sink
    uint256 public totalCredited;
    
    // ============ Roles ============
    
    bytes32 public constant CREDITOR_ROLE = keccak256("CREDITOR");
    
    // ============ Events ============
    
    event Credited(uint256 amount, uint256 newTotal);
    
    // ============ Errors ============
    
    error InvalidAmount();
    error Unauthorized();
    
    // ============ Constructor ============
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CREDITOR_ROLE, msg.sender);
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Credit amount to mezz sink (creditor only)
     * @param amount Amount to credit
     */
    function credit(uint256 amount) external onlyRole(CREDITOR_ROLE) {
        if (amount == 0) revert InvalidAmount();
        
        totalCredited += amount;
        
        emit Credited(amount, totalCredited);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get total amount credited to mezz sink
     * @return Total credited amount
     */
    function getTotalCredited() external view returns (uint256) {
        return totalCredited;
    }
}
