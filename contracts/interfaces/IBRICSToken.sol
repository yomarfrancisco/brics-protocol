// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IBRICSToken
 * @notice Interface for BRICS token
 */
interface IBRICSToken {
    /**
     * @notice Get total supply
     * @return Total supply
     */
    function totalSupply() external view returns (uint256);

    /**
     * @notice Burn tokens from an account
     * @param from Account to burn from
     * @param amount Amount to burn
     */
    function burnFrom(address from, uint256 amount) external;
}
