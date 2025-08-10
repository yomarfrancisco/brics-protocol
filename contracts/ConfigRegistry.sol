// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

// Custom errors
error Unauthorized();
error InvalidLevel();
error BadParam();
error UnknownSovereign(bytes32 code);
error SovereignExists(bytes32 code);

contract ConfigRegistry is AccessControl {
    bytes32 public constant GOV_ROLE = keccak256("GOV");
    bytes32 public constant ECC_ROLE = keccak256("ECC");

    // Global risk limits
    uint256 public maxTailCorrPpm  = 650_000_000; // 0.65 * 1e9
    uint256 public maxSovUtilBps   = 2000;        // 20%
    uint256 public redeemCapBps    = 2500;        // 25%
    uint256 public instantBufferBps= 300;         // 3%

    // Emergency system
    enum EmergencyLevel { NORMAL, YELLOW, ORANGE, RED }
    EmergencyLevel public emergencyLevel = EmergencyLevel.NORMAL;

    struct EmergencyParams {
        uint256 ammMaxSlippageBps;
        uint256 instantBufferBps;
        uint256 maxIssuanceRateBps;  // 10000 = 100%
        uint16  maxDetachmentBps;    // e.g., 10300
    }
    mapping(EmergencyLevel => EmergencyParams) public emergencyParams;

    // Sovereign registry
    struct SovereignCfg { bool exists; uint256 utilCapBps; uint256 haircutBps; uint256 weightBps; }
    mapping(bytes32 => SovereignCfg) public sovereign;
    bytes32[] public sovereignList;

    event ParamSet(bytes32 key, uint256 value);
    event EmergencyLevelSet(uint8 level, string reason);
    event EmergencyParamsSet(uint8 level, EmergencyParams params);
    event SovereignAdded(bytes32 indexed code, uint256 utilCapBps, uint256 haircutBps, uint256 weightBps);
    event SovereignUpdated(bytes32 indexed code, uint256 utilCapBps, uint256 haircutBps, uint256 weightBps);

    constructor(address gov){
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(GOV_ROLE, gov);

        emergencyParams[EmergencyLevel.NORMAL] = EmergencyParams({
            ammMaxSlippageBps: 50,
            instantBufferBps: 300,
            maxIssuanceRateBps: 10000,
            maxDetachmentBps: 10300
        });
        emergencyParams[EmergencyLevel.YELLOW] = EmergencyParams({
            ammMaxSlippageBps: 150,
            instantBufferBps: 500,
            maxIssuanceRateBps: 10000,
            maxDetachmentBps: 10300
        });
        emergencyParams[EmergencyLevel.ORANGE] = EmergencyParams({
            ammMaxSlippageBps: 250,
            instantBufferBps: 800,
            maxIssuanceRateBps: 5000,
            maxDetachmentBps: 10300
        });
        emergencyParams[EmergencyLevel.RED] = EmergencyParams({
            ammMaxSlippageBps: 500,
            instantBufferBps: 1200,
            maxIssuanceRateBps: 0,
            maxDetachmentBps: 10500
        });
    }

    // Global params setters (backward compatible)
    function setMaxTailCorrPpm(uint256 v) external onlyRole(GOV_ROLE){ maxTailCorrPpm=v; emit ParamSet("tail", v); }
    function setMaxSovUtilBps(uint256 v)  external onlyRole(GOV_ROLE){ if (v>10000) revert BadParam(); maxSovUtilBps=v;  emit ParamSet("sov", v); }
    function setRedeemCapBps(uint256 v)   external onlyRole(GOV_ROLE){ if (v>10000) revert BadParam(); redeemCapBps=v;   emit ParamSet("cap", v); }
    function setInstantBufferBps(uint256 v) external onlyRole(GOV_ROLE){ if (v>10000) revert BadParam(); instantBufferBps=v; emit ParamSet("irb", v); }

    // Emergency controls
    function setEmergencyLevel(uint8 level, string calldata reason) external {
        if (!(hasRole(ECC_ROLE, msg.sender) || hasRole(GOV_ROLE, msg.sender))) revert Unauthorized();
        if (level > uint8(EmergencyLevel.RED)) revert InvalidLevel();
        emergencyLevel = EmergencyLevel(level);
        emit EmergencyLevelSet(level, reason);
    }
    function setEmergencyParams(uint8 level, EmergencyParams calldata params) external onlyRole(GOV_ROLE) {
        if (level > uint8(EmergencyLevel.RED)) revert InvalidLevel();
        if (params.maxIssuanceRateBps > 10000) revert BadParam();
        if (params.maxDetachmentBps < 10000 || params.maxDetachmentBps > 10500) revert BadParam();
        emergencyParams[EmergencyLevel(level)] = params;
        emit EmergencyParamsSet(level, params);
    }
    function getCurrentParams() external view returns (EmergencyParams memory) { return emergencyParams[emergencyLevel]; }
    function currentMaxIssuanceRateBps() external view returns (uint256) { return emergencyParams[emergencyLevel].maxIssuanceRateBps; }
    function currentAmmMaxSlippageBps() external view returns (uint256) { return emergencyParams[emergencyLevel].ammMaxSlippageBps; }
    function currentMaxDetachmentBps() external view returns (uint16) { return emergencyParams[emergencyLevel].maxDetachmentBps; }

    // Sovereign registry
    function addSovereign(bytes32 code, uint256 utilCapBps, uint256 haircutBps, uint256 weightBps) external onlyRole(GOV_ROLE) {
        if (code == bytes32(0)) revert BadParam();
        if (sovereign[code].exists) revert SovereignExists(code);
        if (utilCapBps > 10000 || haircutBps > 10000 || weightBps > 10000) revert BadParam();
        sovereign[code] = SovereignCfg({ exists: true, utilCapBps: utilCapBps, haircutBps: haircutBps, weightBps: weightBps });
        sovereignList.push(code);
        emit SovereignAdded(code, utilCapBps, haircutBps, weightBps);
    }
    function updateSovereign(bytes32 code, uint256 utilCapBps, uint256 haircutBps, uint256 weightBps) external onlyRole(GOV_ROLE) {
        if (!sovereign[code].exists) revert UnknownSovereign(code);
        if (utilCapBps > 10000 || haircutBps > 10000 || weightBps > 10000) revert BadParam();
        SovereignCfg storage s = sovereign[code];
        s.utilCapBps = utilCapBps; s.haircutBps = haircutBps; s.weightBps = weightBps;
        emit SovereignUpdated(code, utilCapBps, haircutBps, weightBps);
    }
    function getSovereign(bytes32 code) external view returns (SovereignCfg memory) {
        if (!sovereign[code].exists) revert UnknownSovereign(code);
        return sovereign[code];
    }
    function sovereigns() external view returns (bytes32[] memory) { return sovereignList; }
}
