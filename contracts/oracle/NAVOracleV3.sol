// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {INAVOracleV3} from "../interfaces/INAVOracleV3.sol";
import {IConfigRegistryLike} from "../interfaces/IConfigRegistryLike.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract NAVOracleV3 is INAVOracleV3 {
    using ECDSA for bytes32;

    // Config keys
    bytes32 private constant K_MAX_AGE_SEC = keccak256("oracle.maxAgeSec");
    bytes32 private constant K_DEGRADE_AFTER_SEC = keccak256("oracle.degradeAfterSec");
    bytes32 private constant K_MIN_QUORUM = keccak256("oracle.minQuorum");

    // EIP-712 domain
    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant DOMAIN_NAME = keccak256("BRICS-NAV");
    bytes32 private constant DOMAIN_VERSION = keccak256("3");

    // NAV struct hash
    bytes32 private constant NAV_TYPEHASH = keccak256("NAV(uint256 navRay,uint256 ts,bytes32 modelHash)");

    // State variables
    uint256 private _latestNAVRay;
    uint256 private _lastUpdateTs;
    bool private _isEmergency;
    uint256 private _emergencyNavRay;
    bytes32 private _modelHash;
    address[] private _signers;
    uint256 private _quorum;
    address private _owner;

    // Events
    event NAVSubmitted(uint256 navRay, uint256 ts);
    event EmergencyEnabled(uint256 navRay);
    event EmergencyDisabled();
    event SignersRotated(address[] newSigners);
    event QuorumUpdated(uint256 newQuorum);
    event ModelHashRolled(bytes32 newModelHash);

    constructor(
        address[] memory initialSigners,
        uint256 initialQuorum,
        bytes32 initialModelHash,
        IConfigRegistryLike configRegistry
    ) {
        require(initialSigners.length > 0, "ORACLE/NO_SIGNERS");
        require(initialQuorum > 0 && initialQuorum <= initialSigners.length, "ORACLE/INVALID_QUORUM");
        
        _signers = initialSigners;
        _quorum = initialQuorum;
        _modelHash = initialModelHash;
        _owner = msg.sender;
        
        // Set initial NAV to 1.00 (1e27)
        _latestNAVRay = 1e27;
        _lastUpdateTs = block.timestamp;
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "GW/NOT_OWNER");
        _;
    }

    // Read functions
    function latestNAVRay() external view override returns (uint256) {
        return _isEmergency ? _emergencyNavRay : _latestNAVRay;
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

    // Admin/ops functions
    function rotateSigners(address[] calldata newSigners) external override onlyOwner {
        require(newSigners.length > 0, "ORACLE/NO_SIGNERS");
        require(_quorum <= newSigners.length, "ORACLE/QUORUM_TOO_HIGH");
        
        _signers = newSigners;
        emit SignersRotated(newSigners);
    }

    function updateQuorum(uint256 newQuorum) external override onlyOwner {
        uint256 minQuorum = _getOrDefault(K_MIN_QUORUM, 1);
        require(newQuorum >= minQuorum && newQuorum <= _signers.length, "ORACLE/INVALID_QUORUM");
        
        _quorum = newQuorum;
        emit QuorumUpdated(newQuorum);
    }

    function rollModelHash(bytes32 newModelHash) external override onlyOwner {
        _modelHash = newModelHash;
        emit ModelHashRolled(newModelHash);
    }

    function submitNAV(uint256 navRay, uint256 ts, bytes[] calldata sigs) external override {
        require(navRay > 0, "ORACLE/INVALID_NAV");
        require(ts >= _lastUpdateTs, "ORACLE/STALE_OR_REPLAY");
        
        uint256 maxAgeSec = _getOrDefault(K_MAX_AGE_SEC, 3600);
        require(block.timestamp - ts <= maxAgeSec, "ORACLE/STALE_OR_REPLAY");
        
        // Verify signatures
        bytes32 structHash = keccak256(abi.encode(NAV_TYPEHASH, navRay, ts, _modelHash));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _getDomainSeparator(), structHash));
        
        require(sigs.length >= _quorum, "ORACLE/QUORUM");
        
        address[] memory recoveredSigners = new address[](sigs.length);
        for (uint256 i = 0; i < sigs.length; i++) {
            address signer = digest.recover(sigs[i]);
            require(_isValidSigner(signer), "ORACLE/QUORUM");
            
            // Check for duplicate signatures
            for (uint256 j = 0; j < i; j++) {
                require(recoveredSigners[j] != signer, "ORACLE/DUPLICATE_SIG");
            }
            recoveredSigners[i] = signer;
        }
        
        // Update state
        _latestNAVRay = navRay;
        _lastUpdateTs = ts;
        
        // Auto-disable emergency mode if valid NAV submitted
        if (_isEmergency) {
            _isEmergency = false;
            emit EmergencyDisabled();
        }
        
        emit NAVSubmitted(navRay, ts);
    }

    function enableEmergencyNAV(uint256 emergencyNavRay) external override onlyOwner {
        require(emergencyNavRay > 0, "ORACLE/INVALID_NAV");
        
        _emergencyNavRay = emergencyNavRay;
        _isEmergency = true;
        emit EmergencyEnabled(emergencyNavRay);
    }

    function disableEmergencyNAV() external override onlyOwner {
        _isEmergency = false;
        emit EmergencyDisabled();
    }

    // Internal functions
    function _isValidSigner(address signer) internal view returns (bool) {
        for (uint256 i = 0; i < _signers.length; i++) {
            if (_signers[i] == signer) {
                return true;
            }
        }
        return false;
    }

    function _getOrDefault(bytes32 key, uint256 defaultValue) internal view returns (uint256) {
        // For now, return default values. In production, this would read from ConfigRegistry
        return defaultValue;
    }

    function _getDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                DOMAIN_NAME,
                DOMAIN_VERSION,
                block.chainid,
                address(this)
            )
        );
    }

    // Auto-degradation check (should be called periodically)
    function _checkAutoDegrade() internal {
        uint256 degradeAfterSec = _getOrDefault(K_DEGRADE_AFTER_SEC, 7200);
        if (block.timestamp - _lastUpdateTs > degradeAfterSec && !_isEmergency) {
            _isEmergency = true;
            // Keep last known NAV as emergency NAV if not already set
            if (_emergencyNavRay == 0) {
                _emergencyNavRay = _latestNAVRay;
            }
            emit EmergencyEnabled(_emergencyNavRay);
        }
    }

    // View functions for testing
    function getSigners() external view returns (address[] memory) {
        return _signers;
    }

    function getQuorum() external view returns (uint256) {
        return _quorum;
    }

    function getOwner() external view returns (address) {
        return _owner;
    }
}
