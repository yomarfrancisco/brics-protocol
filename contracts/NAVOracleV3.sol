// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NAVOracleV3
 * @dev NAV Oracle with EIP-712 signature verification and degradation handling
 * @spec §5 Oracle Signer & Degradation
 * @trace SPEC §5: EIP-712 verification, conservative degradation with haircuts, emergency signer override
 */

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

error QuorumNotMet();
error StaleOracle();
error DegradationActive();
error InvalidSignature();
error ExpiredTimestamp();
error InvalidNonce();
error InvalidDegradationLevel();

contract NAVOracleV3 is AccessControl {
    bytes32 public constant ORACLE_ADMIN = keccak256("ORACLE_ADMIN");
    bytes32 public constant MODEL_SIGNER = keccak256("MODEL_SIGNER");
    bytes32 public constant EMERGENCY_SIGNER = keccak256("EMERGENCY_SIGNER");

    // EIP-712 Constants
    string public constant EIP712_NAME = "BRICS_NAV";
    string public constant EIP712_VERSION = "1";
    bytes32 public constant NAV_TYPEHASH = keccak256("SetNAV(uint256 navRay,uint256 ts,uint256 nonce,bytes32 modelHash)");
    
    // Cached domain separator for efficiency
    bytes32 private _DOMAIN_SEPARATOR;
    uint256 private _cachedChainId;

    uint256 private _navRay;
    uint256 private _lastTs;
    uint256 private _nonce;
    bytes32 private _modelHash;
    uint8 private _quorum = 3;

    // SPEC §5: Enhanced degradation mode parameters
    bool public degradationMode;
    uint256 public staleThreshold = 6 hours;          // configurable
    uint256 public maxDailyGrowthBps = 50;            // 0.50%/day cap in degradation
    uint256 public bandFloorBps = 9500;               // 95% of lastKnownGoodNav
    uint256 public bandCeilBps = 10500;               // 105% of lastKnownGoodNav
    uint256 public lastKnownGoodNav;
    uint256 public lastKnownGoodTs;

    // SPEC §5: Haircut tiers applied to *computed* degraded NAV before return
    uint16 public tier1Bps = 200;      // 2%
    uint16 public tier2Bps = 500;      // 5%
    uint16 public tier3Bps = 1000;     // 10%

    // Tier selection thresholds by staleness
    uint256 public t1After = 6 hours;
    uint256 public t2After = 24 hours;
    uint256 public t3After = 72 hours;

    mapping(address => bool) public isSigner;
    mapping(address => bool) public isEmergencySigner;

    event NAVUpdated(uint256 navRay, uint256 ts, uint256 nonce, bytes32 modelHash);
    event ModelHashSet(bytes32 modelHash);
    event SignerSet(address indexed signer, bool ok);
    event EmergencySignerSet(address indexed signer, bool ok);
    event QuorumSet(uint8 quorum);
    event DegradationModeToggled(bool enabled);
    event EmergencyNAVSet(uint256 navRay, uint256 ts, address signer);
    
    // SPEC §5: Enhanced events
    event DegradationEntered(uint256 ts, uint256 lastNav);
    event DegradationExited(uint256 ts, uint256 nav);
    event HaircutParamsSet(uint16 t1, uint16 t2, uint16 t3, uint256 s1, uint256 s2, uint256 s3);
    event BandsSet(uint256 floorBps, uint256 ceilBps, uint256 maxDailyGrowthBps);
    event StaleThresholdSet(uint256 seconds_);

    constructor(address admin, bytes32 modelHash_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN, admin);
        _cachedChainId = block.chainid;
        _DOMAIN_SEPARATOR = _domainSeparatorV4();
        _modelHash = modelHash_;
        emit ModelHashSet(modelHash_);
    }

    // SPEC §5: Cached domain separator for efficiency
    function _domainSeparatorV4() internal view returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(EIP712_NAME)),
            keccak256(bytes(EIP712_VERSION)),
            block.chainid,
            address(this)
        ));
    }

    // Debug function to expose domain separator
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function navRay() external view returns (uint256) { 
        if (degradationMode || _isStale()) {
            uint256 d = _haircut(_degradedBase());
            return d <= 0 ? lastKnownGoodNav : d;
        }
        return _navRay; 
    }
    
    function lastTs() external view returns (uint256) { return _lastTs; }
    function nonce() external view returns (uint256) { return _nonce; }
    function modelHash() external view returns (bytes32) { return _modelHash; }
    function quorum() external view returns (uint8) { return _quorum; }

    // SPEC §5: Get current degradation level
    function getDegradationLevel() external view returns (uint8) {
        if (degradationMode) return 3; // EMERGENCY_OVERRIDE
        
        uint256 timeSinceLastUpdate = block.timestamp - _lastTs;
        
        if (timeSinceLastUpdate >= t3After) {
            return 3; // EMERGENCY_OVERRIDE
        } else if (timeSinceLastUpdate >= t2After) {
            return 2; // DEGRADED
        } else if (timeSinceLastUpdate >= t1After) {
            return 1; // STALE
        }
        
        return 0; // NORMAL
    }

    // SPEC §5: Get haircut percentage for current level
    function getCurrentHaircutBps() external view returns (uint256) {
        uint8 level = this.getDegradationLevel();
        if (level == 1) return tier1Bps;      // STALE
        if (level == 2) return tier2Bps;      // DEGRADED
        if (level == 3) return tier3Bps;      // EMERGENCY_OVERRIDE
        return 0; // NORMAL
    }

    function setModelHash(bytes32 newHash) external onlyRole(ORACLE_ADMIN) { 
        _modelHash = newHash; 
        emit ModelHashSet(newHash); 
    }
    
    function setSigner(address s, bool ok) external onlyRole(ORACLE_ADMIN) { 
        isSigner[s] = ok; 
        emit SignerSet(s, ok); 
    }
    
    function setEmergencySigner(address s, bool ok) external onlyRole(ORACLE_ADMIN) { 
        isEmergencySigner[s] = ok; 
        emit EmergencySignerSet(s, ok); 
    }
    
    function setQuorum(uint8 q) external onlyRole(ORACLE_ADMIN) { 
        require(q > 0, "q>0"); 
        _quorum = q; 
        emit QuorumSet(q); 
    }

    // SPEC §5: Enhanced toggle with proper events
    function toggleDegradationMode(bool enabled) external onlyRole(ORACLE_ADMIN) {
        if (enabled && !degradationMode) {
            if (_navRay > 0) { 
                lastKnownGoodNav = _navRay; 
                lastKnownGoodTs = _lastTs; 
            }
            degradationMode = true;
            emit DegradationEntered(block.timestamp, lastKnownGoodNav);
        } else if (!enabled && degradationMode) {
            degradationMode = false;
            emit DegradationExited(block.timestamp, _navRay);
        }
        emit DegradationModeToggled(enabled);
    }

    // SPEC §5: Admin setters for all parameters
    function setHaircutParams(uint16 t1, uint16 t2, uint16 t3, uint256 s1, uint256 s2, uint256 s3) external onlyRole(ORACLE_ADMIN) {
        require(t1 <= 2000 && t2 <= 3000 && t3 <= 5000, "haircut too big");
        tier1Bps = t1; tier2Bps = t2; tier3Bps = t3; 
        t1After = s1; t2After = s2; t3After = s3;
        emit HaircutParamsSet(t1, t2, t3, s1, s2, s3);
    }

    function setBands(uint256 floorBps_, uint256 ceilBps_, uint256 maxGrowthBps_) external onlyRole(ORACLE_ADMIN) {
        require(floorBps_ <= 10000 && ceilBps_ >= 10000, "bad bands");
        bandFloorBps = floorBps_; 
        bandCeilBps = ceilBps_; 
        maxDailyGrowthBps = maxGrowthBps_;
        emit BandsSet(floorBps_, ceilBps_, maxGrowthBps_);
    }

    function setStaleThreshold(uint256 s) external onlyRole(ORACLE_ADMIN) {
        staleThreshold = s; 
        emit StaleThresholdSet(s);
    }

    // DEV-ONLY helper for local deployments to bootstrap NAV
    function devSeedNAV(uint256 navRay_, uint256 ts) external onlyRole(ORACLE_ADMIN) {
        _navRay = navRay_;
        _lastTs = ts;
        lastKnownGoodNav = navRay_;
        lastKnownGoodTs = ts;
        _nonce = _nonce + 1;
        
        // Reset degradation mode when seeding fresh NAV
        if (degradationMode) {
            degradationMode = false;
            emit DegradationExited(block.timestamp, _navRay);
        }
        
        emit NAVUpdated(navRay_, ts, _nonce, _modelHash);
    }

    function _isStale() internal view returns (bool) {
        return block.timestamp > _lastTs + staleThreshold;
    }

    // SPEC §5: Enhanced degradation math with band clamping
    function _degradedBase() internal view returns (uint256) {
        if (lastKnownGoodNav == 0) return _navRay;
        
        uint256 hoursElapsed = (block.timestamp - lastKnownGoodTs) / 1 hours;
        // daily growth cap (avoid divide-before-multiply)
        uint256 growth = (lastKnownGoodNav * maxDailyGrowthBps * hoursElapsed) / (10000 * 24);
        uint256 base = lastKnownGoodNav + growth;
        
        // band clamp
        uint256 floor_ = (lastKnownGoodNav * bandFloorBps) / 10000;
        uint256 ceil_ = (lastKnownGoodNav * bandCeilBps) / 10000;
        if (base < floor_) base = floor_;
        if (base > ceil_) base = ceil_;
        
        return base;
    }

    // SPEC §5: Haircut application based on staleness
    function _haircut(uint256 x) internal view returns (uint256) {
        uint256 age = block.timestamp - lastKnownGoodTs;
        uint16 bps =
            age >= t3After ? tier3Bps :
            age >= t2After ? tier2Bps :
            age >= t1After ? tier1Bps : 0;
        return (x * (10000 - bps)) / 10000;
    }

    // SPEC §5: EIP-712 hash function
    function _hashSetNAV(uint256 navRay_, uint256 ts, uint256 nonce_) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(NAV_TYPEHASH, navRay_, ts, nonce_, _modelHash));
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }

    // SPEC §5: Enhanced setNAV with EIP-712 M-of-N & replay safety
    function setNAV(uint256 navRay_, uint256 ts, uint256 nonce_, bytes[] calldata sigs) external {
        if (degradationMode) revert DegradationActive();
        require(ts >= _lastTs, "ts rewind");
        require(nonce_ == _nonce + 1, "bad nonce");
        require(sigs.length >= _quorum, "sigs<q");

        bytes32 digest = _hashSetNAV(navRay_, ts, nonce_);
        uint256 valid;
        for (uint256 i; i < sigs.length; ++i) {
            address recovered = _recover(digest, sigs[i]);
            if (isSigner[recovered]) ++valid;
        }
        if (valid < _quorum) revert QuorumNotMet();

        _navRay = navRay_;
        _lastTs = ts;
        _nonce = nonce_;
        lastKnownGoodNav = navRay_;
        lastKnownGoodTs = ts;

        if (degradationMode) {
            degradationMode = false;
            emit DegradationExited(block.timestamp, _navRay);
        }
        emit NAVUpdated(navRay_, ts, nonce_, _modelHash);
    }

    // SPEC §5: Enhanced emergency NAV setting with proper EIP-712
    function emergencySetNAV(uint256 navRay_, uint256 ts, bytes calldata sig) external {
        require(degradationMode || _isStale(), "not in degradation");
        
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01", _domainSeparatorV4(),
            keccak256(abi.encode(
                keccak256("EmergencySetNAV(uint256 navRay,uint256 ts,bytes32 modelHash)"),
                navRay_, ts, _modelHash
            ))
        ));
        
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
