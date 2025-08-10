// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

error QuorumNotMet();
error StaleOracle();
error DegradationActive();

contract NAVOracleV3 is AccessControl {
    bytes32 public constant ORACLE_ADMIN = keccak256("ORACLE_ADMIN");
    bytes32 public constant MODEL_SIGNER = keccak256("MODEL_SIGNER");
    bytes32 public constant EMERGENCY_SIGNER = keccak256("EMERGENCY_SIGNER"); // NASASA + Old Mutual

    uint256 private _navRay;
    uint256 private _lastTs;
    uint256 private _nonce;
    bytes32 private _modelHash;
    uint8   private _quorum = 3;

    // Degradation mode parameters
    bool    public degradationMode;
    uint256 public staleThreshold = 6 hours;
    uint256 public maxDailyGrowthBps = 50; // 0.5% max daily growth when stale
    uint256 public stressMultiplierBps = 15000; // 150% stress multiplier
    uint256 public lastKnownGoodNav;
    uint256 public lastKnownGoodTs;

    mapping(address => bool) public isSigner;
    mapping(address => bool) public isEmergencySigner;

    event NAVUpdated(uint256 navRay, uint256 ts, uint256 nonce, bytes32 modelHash);
    event ModelHashSet(bytes32 modelHash);
    event SignerSet(address indexed signer, bool ok);
    event EmergencySignerSet(address indexed signer, bool ok);
    event QuorumSet(uint8 quorum);
    event DegradationModeToggled(bool enabled);
    event EmergencyNAVSet(uint256 navRay, uint256 ts, address signer);

    constructor(address admin, bytes32 modelHash_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN, admin);
        _modelHash = modelHash_;
        emit ModelHashSet(modelHash_);
    }

    function navRay() external view returns (uint256) { 
        if (degradationMode || _isStale()) {
            return _getDegradedNAV();
        }
        return _navRay; 
    }
    
    function lastTs() external view returns (uint256) { return _lastTs; }
    function nonce() external view returns (uint256) { return _nonce; }
    function modelHash() external view returns (bytes32) { return _modelHash; }
    function quorum() external view returns (uint8) { return _quorum; }

    function setModelHash(bytes32 newHash) external onlyRole(ORACLE_ADMIN) { 
        _modelHash = newHash; 
        emit ModelHashSet(newHash); 
    }
    
    function setSigner(address s, bool ok) external onlyRole(ORACLE_ADMIN) { 
        isSigner[s]=ok; 
        emit SignerSet(s, ok); 
    }
    
    function setEmergencySigner(address s, bool ok) external onlyRole(ORACLE_ADMIN) { 
        isEmergencySigner[s]=ok; 
        emit EmergencySignerSet(s, ok); 
    }
    
    function setQuorum(uint8 q) external onlyRole(ORACLE_ADMIN) { 
        require(q>0, "q>0"); 
        _quorum=q; 
        emit QuorumSet(q); 
    }

    function toggleDegradationMode(bool enabled) external onlyRole(ORACLE_ADMIN) {
        degradationMode = enabled;
        if (enabled && !_isStale()) {
            lastKnownGoodNav = _navRay;
            lastKnownGoodTs = _lastTs;
        }
        emit DegradationModeToggled(enabled);
    }

    // DEV-ONLY helper for local deployments to bootstrap NAV
    function devSeedNAV(uint256 navRay_, uint256 ts) external onlyRole(ORACLE_ADMIN) {
        _navRay = navRay_;
        _lastTs = ts;
        lastKnownGoodNav = navRay_;
        lastKnownGoodTs = ts;
        _nonce = _nonce + 1;
        emit NAVUpdated(navRay_, ts, _nonce, _modelHash);
    }

    function _isStale() internal view returns (bool) {
        return block.timestamp > _lastTs + staleThreshold;
    }

    function _getDegradedNAV() internal view returns (uint256) {
        if (lastKnownGoodNav == 0) return _navRay; // fallback to last known
        
        uint256 timeElapsed = block.timestamp - lastKnownGoodTs;
        uint256 maxGrowth = (lastKnownGoodNav * maxDailyGrowthBps * timeElapsed) / (10000 * 1 days);
        uint256 stressAdjustment = (lastKnownGoodNav * stressMultiplierBps) / 10000;
        
        return lastKnownGoodNav + maxGrowth + stressAdjustment;
    }

    function setNAV(
        uint256 navRay_,
        uint256 ts,
        uint256 nonce_,
        bytes[] calldata sigs
    ) external {
        if (degradationMode) revert DegradationActive();
        
        require(ts >= _lastTs, "ts rewind");
        require(nonce_ == _nonce + 1, "bad nonce");
        require(sigs.length >= _quorum, "sigs<q");

        bytes32 digest = keccak256(abi.encodePacked(address(this), navRay_, ts, nonce_, _modelHash));

        uint256 valid;
        for (uint256 i; i < sigs.length; ++i) {
            address recovered = _recover(digest, sigs[i]);
            if (isSigner[recovered]) ++valid;
        }
        if (valid < _quorum) revert QuorumNotMet();

        _navRay = navRay_;
        _lastTs = ts;
        _nonce  = nonce_;
        lastKnownGoodNav = navRay_;
        lastKnownGoodTs = ts;
        emit NAVUpdated(navRay_, ts, nonce_, _modelHash);
    }

    function emergencySetNAV(uint256 navRay_, uint256 ts, bytes calldata sig) external {
        require(degradationMode, "not in degradation");
        
        bytes32 digest = keccak256(abi.encodePacked("EMERGENCY", address(this), navRay_, ts));
        address recovered = _recover(digest, sig);
        require(isEmergencySigner[recovered], "not emergency signer");
        
        _navRay = navRay_;
        _lastTs = ts;
        emit EmergencyNAVSet(navRay_, ts, recovered);
    }

    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
        if (v < 27) v += 27;
        return ecrecover(digest, v, r, s);
    }
}
