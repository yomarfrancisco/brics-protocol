// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {INAVOracleV3} from "../interfaces/INAVOracleV3.sol";

/**
 * @title MockNAVOracleV3
 * @notice Mock NAV oracle for testing with failure simulation capabilities
 */
contract MockNAVOracleV3 is INAVOracleV3 {
    uint256 private _navRay;
    uint256 private _lastUpdateTs;
    bool private _isEmergency;
    uint256 private _emergencyNavRay;
    bytes32 private _modelHash;
    address[] private _signers;
    uint256 private _quorum;
    
    // Test control variables
    bool private _failNext;
    mapping(bytes32 => uint256) private _navByKey;
    
    // NAV/TWAP sanity guard
    uint256 public maxJumpBps = 500; // 5% default
    bool public emergencyEnabled = false;
    uint256 public lastNavRay;

    constructor() {
        _navRay = 1e27; // 1.00 NAV
        _lastUpdateTs = block.timestamp;
        _isEmergency = false;
        _modelHash = keccak256("v1.0.0");
        _signers = new address[](0);
        _quorum = 0;
    }

    // Test control functions
    function setNAV(uint256 nav) external {
        _navRay = nav * 1e27 / 1e18; // Convert from ether to ray
        _lastUpdateTs = block.timestamp;
        lastNavRay = _navRay;
    }

    function setNAVByKey(bytes32 key, uint256 nav) external {
        _navByKey[key] = nav * 1e27 / 1e18; // Convert from ether to ray
    }

    function setFailNext(bool fail) external {
        _failNext = fail;
    }

    function setMaxJumpBps(uint256 bps) external {
        maxJumpBps = bps;
    }

    function setEmergency(bool on) external {
        emergencyEnabled = on;
    }

    function setNavRay(uint256 navRay) external {
        if (lastNavRay != 0 && !emergencyEnabled) {
            uint256 hi = lastNavRay * (10000 + maxJumpBps) / 10000;
            uint256 lo = lastNavRay * (10000 - maxJumpBps) / 10000;
            require(navRay >= lo && navRay <= hi, "NAV_JUMP");
        }
        lastNavRay = navRay;
        _navRay = navRay;
    }

    function latestNAVRay() external view override returns (uint256) {
        if (_failNext) {
            revert("MockNAVOracleV3: simulated failure");
        }
        return _isEmergency ? _emergencyNavRay : _navRay;
    }

    function navRay() external view returns (uint256) {
        if (_failNext) {
            revert("MockNAVOracleV3: simulated failure");
        }
        return _isEmergency ? _emergencyNavRay : _navRay;
    }

    function latestNAV(bytes32 key) external view returns (uint256) {
        if (_failNext) {
            revert("MockNAVOracleV3: simulated failure");
        }
        uint256 nav = _navByKey[key];
        if (nav == 0) {
            nav = _isEmergency ? _emergencyNavRay : _navRay;
        }
        return nav;
    }

    function lastUpdateTs() external view override returns (uint256) {
        return _lastUpdateTs;
    }

    function isEmergency() external view override returns (bool) {
        return _isEmergency;
    }

    function modelHash() external view override returns (bytes32) {
        return _modelHash;
    }

    function rotateSigners(address[] calldata newSigners) external override {
        _signers = newSigners;
    }

    function updateQuorum(uint256 newQuorum) external override {
        _quorum = newQuorum;
    }

    function rollModelHash(bytes32 newModelHash) external override {
        _modelHash = newModelHash;
    }

    function submitNAV(uint256 navRay, uint256 ts, bytes[] calldata sigs) external override {
        _navRay = navRay;
        _lastUpdateTs = ts;
        if (_isEmergency) {
            _isEmergency = false;
        }
    }

    function enableEmergencyNAV(uint256 emergencyNavRay) external override {
        _emergencyNavRay = emergencyNavRay;
        _isEmergency = true;
    }

    function disableEmergencyNAV() external override {
        _isEmergency = false;
    }

    function setLatestNAVRay(uint256 navRay) external {
        if (lastNavRay != 0 && !emergencyEnabled) {
            uint256 hi = lastNavRay * (10000 + maxJumpBps) / 10000;
            uint256 lo = lastNavRay * (10000 - maxJumpBps) / 10000;
            require(navRay >= lo && navRay <= hi, "NAV_JUMP");
        }
        lastNavRay = navRay;
        _navRay = navRay;
    }
}
