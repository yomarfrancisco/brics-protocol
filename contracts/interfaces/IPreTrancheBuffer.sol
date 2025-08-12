// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPreTrancheBuffer
 * @notice Interface for pre-tranche buffer
 */
interface IPreTrancheBuffer {
    /**
     * @notice Get available instant capacity for a member
     * @param member Member address
     * @return Available capacity
     */
    function availableInstantCapacity(address member) external view returns (uint256);

    /**
     * @notice Process instant redemption
     * @param member Member address
     * @param amount Amount to redeem
     */
    function instantRedeem(address member, uint256 amount) external;
}
