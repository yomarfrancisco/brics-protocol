// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IMemberRegistry
 * @notice Interface for member registry
 */
interface IMemberRegistry {
    /**
     * @notice Check if address is a member
     * @param account Address to check
     * @return True if member
     */
    function isMember(address account) external view returns (bool);

    /**
     * @notice Check if address is a whitelisted pool
     * @param account Address to check
     * @return True if whitelisted pool
     */
    function isWhitelistedPool(address account) external view returns (bool);
}

