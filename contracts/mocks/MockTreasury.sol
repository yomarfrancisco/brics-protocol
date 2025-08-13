// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITreasury} from "../interfaces/ITreasury.sol";

/**
 * @title MockTreasury
 * @notice Mock treasury for testing
 */
contract MockTreasury is ITreasury {
    function pay(address recipient, uint256 amount) external override {
        // Mock implementation - just emit an event
        emit MockPay(recipient, amount);
    }

    event MockPay(address recipient, uint256 amount);
}

