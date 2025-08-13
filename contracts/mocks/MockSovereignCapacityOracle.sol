// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISovereignCapacityOracle} from "../oracle/ISovereignCapacityOracle.sol";

/**
 * @title MockSovereignCapacityOracle
 * @notice Mock sovereign capacity oracle for testing
 */
contract MockSovereignCapacityOracle is ISovereignCapacityOracle {
    uint256 public capacity;
    uint64 public asOf;

    constructor(uint256 _capacity) {
        capacity = _capacity;
        asOf = uint64(block.timestamp);
    }

    function setCapacity(uint256 _capacity) external {
        capacity = _capacity;
        asOf = uint64(block.timestamp);
    }

    function setCapacityWithTimestamp(uint256 _capacity, uint64 _asOf) external {
        capacity = _capacity;
        asOf = _asOf;
    }

    function latestCapacity() external view override returns (uint256, uint64) {
        return (capacity, asOf);
    }
}
