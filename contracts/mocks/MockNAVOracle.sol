// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {INAVOracleV3} from "../interfaces/INAVOracleV3.sol";

contract MockNAVOracle is INAVOracleV3 {
    uint256 private _navRay;
    uint256 private _lastUpdateTs;
    bool private _isEmergency;
    uint256 private _emergencyNavRay;
    bytes32 private _modelHash;
    address[] private _signers;
    uint256 private _quorum;

    constructor() {
        _navRay = 1e27; // 1.00 NAV
        _lastUpdateTs = block.timestamp;
        _isEmergency = false;
        _modelHash = keccak256("v1.0.0");
        _signers = new address[](0);
        _quorum = 0;
    }

    function setNavRay(uint256 navRay) external {
        _navRay = navRay;
    }

    function latestNAVRay() external view override returns (uint256) {
        return _isEmergency ? _emergencyNavRay : _navRay;
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
        _navRay = navRay;
    }
}
