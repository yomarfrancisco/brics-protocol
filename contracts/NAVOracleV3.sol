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
    bytes32 public constant EMERGENCY_SIGNER = keccak256("EMERGENCY_SIGNER"); // NASASA + Old Mutual

    // EIP-712 Domain Separator
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("BRICS NAV Oracle")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // EIP-712 Type Hash for NAV Update
    bytes32 public constant NAV_UPDATE_TYPEHASH = keccak256(
        "NAVUpdate(uint256 navRay,uint256 timestamp,uint256 nonce,bytes32 modelHash)"
    );

    uint256 private _navRay;
    uint256 private _lastTs;
    uint256 private _nonce;
    bytes32 private _modelHash;
    uint8   private _quorum = 3;

    // SPEC §5: Enhanced degradation mode parameters
    bool    public degradationMode;
    uint256 public staleThreshold = 6 hours;
    uint256 public maxDailyGrowthBps = 50; // 0.5% max daily growth when stale
    uint256 public stressMultiplierBps = 15000; // 150% stress multiplier
    uint256 public lastKnownGoodNav;
    uint256 public lastKnownGoodTs;

    // SPEC §5: Conservative degradation with haircuts
    enum DegradationLevel { NORMAL, STALE, DEGRADED, EMERGENCY_OVERRIDE }
    DegradationLevel public currentDegradationLevel = DegradationLevel.NORMAL;
    
    // Haircut tiers: 2%, 5%, 10%
    uint256 public constant STALE_HAIRCUT_BPS = 200;      // 2%
    uint256 public constant DEGRADED_HAIRCUT_BPS = 500;   // 5%
    uint256 public constant EMERGENCY_HAIRCUT_BPS = 1000; // 10%
    
    // Time thresholds for degradation levels
    uint256 public STALE_THRESHOLD = 2 hours;
    uint256 public DEGRADED_THRESHOLD = 6 hours;
    uint256 public EMERGENCY_THRESHOLD = 24 hours;

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
    event DegradationLevelChanged(DegradationLevel from, DegradationLevel to, uint256 timestamp);
    event HaircutApplied(DegradationLevel level, uint256 originalNav, uint256 haircutNav, uint256 haircutBps);

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

    // SPEC §5: Get current degradation level
    function getDegradationLevel() external view returns (DegradationLevel) {
        return _getCurrentDegradationLevel();
    }

    // SPEC §5: Get haircut percentage for current level
    function getCurrentHaircutBps() external view returns (uint256) {
        DegradationLevel level = _getCurrentDegradationLevel();
        if (level == DegradationLevel.STALE) return STALE_HAIRCUT_BPS;
        if (level == DegradationLevel.DEGRADED) return DEGRADED_HAIRCUT_BPS;
        if (level == DegradationLevel.EMERGENCY_OVERRIDE) return EMERGENCY_HAIRCUT_BPS;
        return 0; // NORMAL
    }

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

    // SPEC §5: Set degradation thresholds
    function setDegradationThresholds(
        uint256 staleThreshold_,
        uint256 degradedThreshold_,
        uint256 emergencyThreshold_
    ) external onlyRole(ORACLE_ADMIN) {
        require(staleThreshold_ < degradedThreshold_ && degradedThreshold_ < emergencyThreshold_, "invalid thresholds");
        STALE_THRESHOLD = staleThreshold_;
        DEGRADED_THRESHOLD = degradedThreshold_;
        EMERGENCY_THRESHOLD = emergencyThreshold_;
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

    // SPEC §5: Enhanced degradation level calculation
    function _getCurrentDegradationLevel() internal view returns (DegradationLevel) {
        if (degradationMode) return DegradationLevel.EMERGENCY_OVERRIDE;
        
        uint256 timeSinceLastUpdate = block.timestamp - _lastTs;
        
        if (timeSinceLastUpdate >= EMERGENCY_THRESHOLD) {
            return DegradationLevel.EMERGENCY_OVERRIDE;
        } else if (timeSinceLastUpdate >= DEGRADED_THRESHOLD) {
            return DegradationLevel.DEGRADED;
        } else if (timeSinceLastUpdate >= STALE_THRESHOLD) {
            return DegradationLevel.STALE;
        }
        
        return DegradationLevel.NORMAL;
    }

    // SPEC §5: Enhanced degraded NAV calculation with haircuts
    function _getDegradedNAV() internal view returns (uint256) {
        if (lastKnownGoodNav == 0) return _navRay; // fallback to last known
        
        DegradationLevel level = _getCurrentDegradationLevel();
        uint256 baseNav = lastKnownGoodNav;
        
        // Apply growth cap and stress multiplier
        uint256 timeElapsed = block.timestamp - lastKnownGoodTs;
        uint256 maxGrowth = (baseNav * maxDailyGrowthBps * timeElapsed) / (10000 * 1 days);
        uint256 stressAdjustment = (baseNav * stressMultiplierBps) / 10000;
        
        uint256 adjustedNav = baseNav + maxGrowth + stressAdjustment;
        
        // Apply haircut based on degradation level
        uint256 haircutBps = 0;
        if (level == DegradationLevel.STALE) {
            haircutBps = STALE_HAIRCUT_BPS;
        } else if (level == DegradationLevel.DEGRADED) {
            haircutBps = DEGRADED_HAIRCUT_BPS;
        } else if (level == DegradationLevel.EMERGENCY_OVERRIDE) {
            haircutBps = EMERGENCY_HAIRCUT_BPS;
        }
        
        if (haircutBps > 0) {
            uint256 haircutAmount = (adjustedNav * haircutBps) / 10000;
            adjustedNav = adjustedNav - haircutAmount;
            
            // Emit event for tracking (in a real implementation, this would be in a function that can emit)
            // emit HaircutApplied(level, adjustedNav + haircutAmount, adjustedNav, haircutBps);
        }
        
        return adjustedNav;
    }

    // SPEC §5: Enhanced setNAV with EIP-712 signature verification
    function setNAV(
        uint256 navRay_,
        uint256 ts,
        uint256 nonce_,
        bytes[] calldata sigs
    ) external {
        if (degradationMode) revert DegradationActive();
        
        // SPEC §5: Timestamp and nonce validation
        if (ts < _lastTs) revert("ts rewind");
        if (ts < block.timestamp - 1 hours) revert ExpiredTimestamp(); // Allow 1 hour tolerance
        if (nonce_ != _nonce + 1) revert InvalidNonce();
        if (sigs.length < _quorum) revert("sigs<q");

        // SPEC §5: EIP-712 signature verification
        bytes32 structHash = keccak256(
            abi.encode(NAV_UPDATE_TYPEHASH, navRay_, ts, nonce_, _modelHash)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash)
        );

        uint256 valid;
        for (uint256 i; i < sigs.length; ++i) {
            address recovered = _recover(digest, sigs[i]);
            if (isSigner[recovered]) ++valid;
        }
        if (valid < _quorum) revert QuorumNotMet();

        // Update NAV and reset degradation
        _updateNAV(navRay_, ts, nonce_);
        
        // SPEC §5: Update degradation level
        DegradationLevel oldLevel = currentDegradationLevel;
        currentDegradationLevel = DegradationLevel.NORMAL;
        if (oldLevel != DegradationLevel.NORMAL) {
            emit DegradationLevelChanged(oldLevel, DegradationLevel.NORMAL, block.timestamp);
        }
    }

    // SPEC §5: Enhanced emergency NAV setting with EIP-712
    function emergencySetNAV(uint256 navRay_, uint256 ts, bytes calldata sig) external {
        require(degradationMode || _getCurrentDegradationLevel() >= DegradationLevel.DEGRADED, "not in degradation");
        
        // SPEC §5: EIP-712 signature verification for emergency
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("EmergencyNAVUpdate(uint256 navRay,uint256 timestamp)"),
                navRay_,
                ts
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash)
        );
        
        address recovered = _recover(digest, sig);
        require(isEmergencySigner[recovered], "not emergency signer");
        
        // Update NAV
        _navRay = navRay_;
        _lastTs = ts;
        
        // SPEC §5: Set to emergency override level
        DegradationLevel oldLevel = currentDegradationLevel;
        currentDegradationLevel = DegradationLevel.EMERGENCY_OVERRIDE;
        if (oldLevel != DegradationLevel.EMERGENCY_OVERRIDE) {
            emit DegradationLevelChanged(oldLevel, DegradationLevel.EMERGENCY_OVERRIDE, block.timestamp);
        }
        
        emit EmergencyNAVSet(navRay_, ts, recovered);
    }

    // SPEC §5: Internal NAV update function
    function _updateNAV(uint256 navRay_, uint256 ts, uint256 nonce_) internal {
        _navRay = navRay_;
        _lastTs = ts;
        _nonce = nonce_;
        lastKnownGoodNav = navRay_;
        lastKnownGoodTs = ts;
        emit NAVUpdated(navRay_, ts, nonce_, _modelHash);
    }

    // SPEC §5: Force degradation level update (for testing and monitoring)
    function updateDegradationLevel() external {
        DegradationLevel newLevel = _getCurrentDegradationLevel();
        if (newLevel != currentDegradationLevel) {
            DegradationLevel oldLevel = currentDegradationLevel;
            currentDegradationLevel = newLevel;
            emit DegradationLevelChanged(oldLevel, newLevel, block.timestamp);
        }
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
