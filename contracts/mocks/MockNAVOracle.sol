// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockNAVOracle
 * @dev Mock NAV oracle for testing sovereign guarantee integration
 */

contract MockNAVOracle {
    uint256 public navRay = 1e27; // 1.0 NAV
    uint256 public lastTs;
    bool public degradationMode;

    constructor() {
        lastTs = block.timestamp;
    }

    function setNAV(uint256 _navRay) external {
        navRay = _navRay;
        lastTs = block.timestamp;
    }

    function setDegradationMode(bool _degradationMode) external {
        degradationMode = _degradationMode;
    }

    // Mock implementation for testing
    function getDegradationLevel() external view returns (uint8) {
        if (degradationMode) return 3; // EMERGENCY_OVERRIDE
        return 0; // NORMAL for testing
    }

    function getCurrentHaircutBps() external view returns (uint256) {
        if (degradationMode) return 1000; // 10% haircut
        return 0; // No haircut for testing
    }
}
