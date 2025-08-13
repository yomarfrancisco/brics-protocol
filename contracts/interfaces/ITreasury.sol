// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITreasury
 * @notice Interface for treasury
 */
interface ITreasury {
    /**
     * @notice Pay USDC to recipient
     * @param recipient Recipient address
     * @param amount Amount to pay
     */
    function pay(address recipient, uint256 amount) external;
}

