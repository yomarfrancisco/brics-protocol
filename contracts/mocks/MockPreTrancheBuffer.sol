// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPreTrancheBuffer} from "../interfaces/IPreTrancheBuffer.sol";

/**
 * @title MockPreTrancheBuffer
 * @notice Mock pre-tranche buffer for testing
 */
contract MockPreTrancheBuffer is IPreTrancheBuffer {
    uint256 public availableCapacity;

    function setAvailableCapacity(uint256 capacity) external {
        availableCapacity = capacity;
    }

    function availableInstantCapacity(address member) external view override returns (uint256) {
        return availableCapacity;
    }

    function instantRedeem(address member, uint256 amount) external override {
        // Mock implementation - just emit an event
        emit MockInstantRedeem(member, amount);
    }

    event MockInstantRedeem(address member, uint256 amount);
}

