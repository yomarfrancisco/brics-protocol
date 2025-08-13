// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ConfigRegistry
 * @dev Global risk parameters, emergency levels, and cross-sovereign configuration
 * @spec §6 Cross-Sovereign Configuration
 * @trace SPEC §6: CRUD operations, bps validation, insertion order, enabled flag
 */

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

    // Economics parameters
    uint256 public tradeFeeBps     = 50;          // 0.5% trade fee
    uint256 public pmmCurveK_bps   = 1000;        // 10% PMM curve K
    uint256 public pmmTheta_bps    = 500;         // 5% PMM theta
    uint256 public maxBoundBps     = 5000;        // 50% max bound sanity
    uint256 public issuanceCapBufferBps = 500;    // 5% issuance cap buffer

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

    // Sovereign registry - SPEC §6: Cross-sovereign config CRUD
    struct SovereignCfg { 
        bool exists; 
        uint256 utilCapBps; 
        uint256 haircutBps; 
        uint256 weightBps; 
        bool enabled; // SPEC §6: "enabled" flag gating capacity
    }
    mapping(bytes32 => SovereignCfg) public sovereign;
    bytes32[] public sovereignList;

    // Per-tranche risk adjustment overrides
    mapping(uint256 => uint16) private _trancheRiskAdjOverrideBps;
    
    // Per-tranche risk confidence bands (floor/ceiling)
    mapping(uint256 => uint16) private _trancheRiskFloorBps;
    mapping(uint256 => uint16) private _trancheRiskCeilBps;

    // Per-tranche rolling average configuration
    mapping(uint256 => uint16) private _trancheRollingWindowDays; // 0 = disabled
    mapping(uint256 => bool) private _trancheRollingEnabled;

    // Rolling average data storage (fixed-size circular buffer)
    struct RiskPoint {
        uint16 riskAdjBps;
        uint64 timestamp;
    }

    struct RollingBuf {
        uint8 index;      // Current circular buffer index
        uint8 count;      // Number of valid data points
        RiskPoint[30] buf; // Fixed-size buffer (30 slots)
    }

    mapping(uint256 => RollingBuf) private _trancheRollingData;

    event ParamSet(bytes32 key, uint256 value);
    event EmergencyLevelSet(uint8 level, string reason);
    event EmergencyParamsSet(uint8 level, EmergencyParams params);
    event SovereignAdded(bytes32 indexed code, uint256 utilCapBps, uint256 haircutBps, uint256 weightBps, bool enabled);
    event SovereignUpdated(bytes32 indexed code, uint256 utilCapBps, uint256 haircutBps, uint256 weightBps, bool enabled);
    event SovereignEnabled(bytes32 indexed code, bool enabled);
    event TrancheRiskOverrideSet(uint256 indexed trancheId, uint16 oldVal, uint16 newVal);
    event TrancheRiskBandsSet(uint256 indexed trancheId, uint16 floorBps, uint16 ceilBps);
    event TrancheRollingWindowSet(uint256 indexed trancheId, uint16 oldWindow, uint16 newWindow);
    event TrancheRollingEnabledSet(uint256 indexed trancheId, bool enabled);
    event TrancheRollingPointAppended(uint256 indexed trancheId, uint16 riskAdjBps, uint64 timestamp);

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
    function setMaxTailCorrPpm(uint256 v) external onlyRole(GOV_ROLE){ 
        if (v > 1_000_000_000) revert BadParam(); // Max 1.0 correlation
        maxTailCorrPpm=v; 
        emit ParamSet("tail", v); 
    }
    function setMaxSovUtilBps(uint256 v)  external onlyRole(GOV_ROLE){ 
        if (v>10000) revert BadParam(); 
        maxSovUtilBps=v;  
        emit ParamSet("sov", v); 
    }
    function setRedeemCapBps(uint256 v)   external onlyRole(GOV_ROLE){ 
        if (v>10000) revert BadParam(); 
        redeemCapBps=v;   
        emit ParamSet("cap", v); 
    }
    function setInstantBufferBps(uint256 v) external onlyRole(GOV_ROLE){ 
        if (v>10000) revert BadParam(); 
        instantBufferBps=v; 
        emit ParamSet("irb", v); 
    }

    // Economics parameter setters
    function setTradeFeeBps(uint256 v) external onlyRole(GOV_ROLE){ 
        if (v>20000) revert BadParam(); // Max 200% fee
        tradeFeeBps=v; 
        emit ParamSet("trade", v); 
    }
    function setPmmCurveK_bps(uint256 v) external onlyRole(GOV_ROLE){ 
        if (v>20000) revert BadParam(); // Max 200% K
        pmmCurveK_bps=v; 
        emit ParamSet("pmm_k", v); 
    }
    function setPmmTheta_bps(uint256 v) external onlyRole(GOV_ROLE){ 
        if (v>20000) revert BadParam(); // Max 200% theta
        pmmTheta_bps=v; 
        emit ParamSet("pmm_theta", v); 
    }
    function setMaxBoundBps(uint256 v) external onlyRole(GOV_ROLE){ 
        if (v>20000) revert BadParam(); // Max 200% bound
        maxBoundBps=v; 
        emit ParamSet("max_bound", v); 
    }
    function setIssuanceCapBufferBps(uint256 v) external onlyRole(GOV_ROLE){ 
        if (v>10000) revert BadParam(); // Max 100% buffer
        issuanceCapBufferBps=v; 
        emit ParamSet("issuance_buffer", v); 
    }

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

    // Sovereign registry - SPEC §6: Cross-sovereign config CRUD
    function addSovereign(bytes32 code, uint256 utilCapBps, uint256 haircutBps, uint256 weightBps, bool enabled) external onlyRole(GOV_ROLE) {
        if (code == bytes32(0)) revert BadParam();
        if (sovereign[code].exists) revert SovereignExists(code);
        if (utilCapBps > 10000 || haircutBps > 10000 || weightBps > 10000) revert BadParam();
        sovereign[code] = SovereignCfg({ 
            exists: true, 
            utilCapBps: utilCapBps, 
            haircutBps: haircutBps, 
            weightBps: weightBps,
            enabled: enabled
        });
        sovereignList.push(code);
        emit SovereignAdded(code, utilCapBps, haircutBps, weightBps, enabled);
    }
    
    function updateSovereign(bytes32 code, uint256 utilCapBps, uint256 haircutBps, uint256 weightBps, bool enabled) external onlyRole(GOV_ROLE) {
        if (!sovereign[code].exists) revert UnknownSovereign(code);
        if (utilCapBps > 10000 || haircutBps > 10000 || weightBps > 10000) revert BadParam();
        SovereignCfg storage s = sovereign[code];
        s.utilCapBps = utilCapBps; 
        s.haircutBps = haircutBps; 
        s.weightBps = weightBps;
        s.enabled = enabled;
        emit SovereignUpdated(code, utilCapBps, haircutBps, weightBps, enabled);
    }
    
    function setSovereignEnabled(bytes32 code, bool enabled) external onlyRole(GOV_ROLE) {
        if (!sovereign[code].exists) revert UnknownSovereign(code);
        sovereign[code].enabled = enabled;
        emit SovereignEnabled(code, enabled);
    }
    
    function getSovereign(bytes32 code) external view returns (SovereignCfg memory) {
        if (!sovereign[code].exists) revert UnknownSovereign(code);
        return sovereign[code];
    }
    
    function sovereigns() external view returns (bytes32[] memory) { return sovereignList; }
    
    // SPEC §3: Per-sovereign soft-cap damping helper functions
    function getEffectiveCapacity(bytes32 sovereignCode) external view returns (uint256 effectiveCap, bool isEnabled) {
        if (!sovereign[sovereignCode].exists) revert UnknownSovereign(sovereignCode);
        SovereignCfg memory cfg = sovereign[sovereignCode];
        if (!cfg.enabled) return (0, false);
        
        // Effective capacity = cap * (1 - haircutBps/10000)
        effectiveCap = cfg.utilCapBps * (10000 - cfg.haircutBps) / 10000;
        isEnabled = true;
    }
    
    function getTotalEffectiveCapacity() external view returns (uint256 totalCap) {
        for (uint256 i = 0; i < sovereignList.length; i++) {
            bytes32 code = sovereignList[i];
            SovereignCfg memory cfg = sovereign[code];
            if (cfg.enabled) {
                uint256 effectiveCap = cfg.utilCapBps * (10000 - cfg.haircutBps) / 10000;
                totalCap += effectiveCap;
            }
        }
    }
    
    // View helper for emergency level bounds (centralized logic)
    function getBoundsForLevel(uint8 level) external pure returns (uint256 minBps, uint256 maxBps) {
        if (level == 0) {
            // Level 0 (Normal): ±2%
            minBps = 9800;
            maxBps = 10200;
        } else if (level == 1) {
            // Level 1 (Amber): ±1%
            minBps = 9900;
            maxBps = 10100;
        } else if (level == 2) {
            // Level 2 (Red): ±0.25%
            minBps = 9975;
            maxBps = 10025;
        } else {
            // Level 3+ (Disabled): most restrictive
            minBps = 9975;
            maxBps = 10025;
        }
    }

    // View helper for economics parameters
    // Note: Per-tranche risk overrides and confidence bands are applied downstream in read surfaces
    function getEconomics() external view returns (
        uint256 tradeFeeBps_,
        uint256 pmmCurveK_bps_,
        uint256 pmmTheta_bps_,
        uint256 maxBoundBps_
    ) {
        return (tradeFeeBps, pmmCurveK_bps, pmmTheta_bps, maxBoundBps);
    }

    // View helper for issuance cap calculation
    function getMaxIssuable(uint256 oracleCapacity) external view returns (uint256 maxIssuable) {
        // maxIssuable = capacity * (10000 - bufferBps) / 10000
        maxIssuable = oracleCapacity * (10000 - issuanceCapBufferBps) / 10000;
    }

    // Per-tranche risk adjustment override functions
    function trancheRiskAdjOverrideBps(uint256 trancheId) external view returns (uint16) {
        return _trancheRiskAdjOverrideBps[trancheId];
    }

    function setTrancheRiskAdjOverrideBps(uint256 trancheId, uint16 newVal) external onlyRole(GOV_ROLE) {
        if (newVal > maxBoundBps) revert BadParam(); // Cannot exceed max bound
        uint16 oldVal = _trancheRiskAdjOverrideBps[trancheId];
        _trancheRiskAdjOverrideBps[trancheId] = newVal;
        emit TrancheRiskOverrideSet(trancheId, oldVal, newVal);
    }

    // Per-tranche risk confidence bands functions
    function trancheRiskFloorBps(uint256 trancheId) external view returns (uint16) {
        return _trancheRiskFloorBps[trancheId];
    }

    function trancheRiskCeilBps(uint256 trancheId) external view returns (uint16) {
        return _trancheRiskCeilBps[trancheId];
    }

    function setTrancheRiskBands(uint256 trancheId, uint16 floorBps, uint16 ceilBps) external onlyRole(GOV_ROLE) {
        if (floorBps > ceilBps) revert BadParam(); // "Bands: floor>ceil"
        if (ceilBps > maxBoundBps) revert BadParam(); // "Bands: ceil>max"
        _trancheRiskFloorBps[trancheId] = floorBps;
        _trancheRiskCeilBps[trancheId] = ceilBps;
        emit TrancheRiskBandsSet(trancheId, floorBps, ceilBps);
    }

    // Per-tranche rolling average functions
    function trancheRollingEnabled(uint256 trancheId) external view returns (bool) {
        return _trancheRollingEnabled[trancheId];
    }

    function trancheRollingWindowDays(uint256 trancheId) external view returns (uint16) {
        return _trancheRollingWindowDays[trancheId];
    }

    function setTrancheRollingWindow(uint256 trancheId, uint16 windowDays) external onlyRole(GOV_ROLE) {
        if (windowDays == 0 || windowDays > 90) revert BadParam(); // "Window: 1-90 days"
        uint16 oldWindow = _trancheRollingWindowDays[trancheId];
        _trancheRollingWindowDays[trancheId] = windowDays;
        emit TrancheRollingWindowSet(trancheId, oldWindow, windowDays);
    }

    function setTrancheRollingEnabled(uint256 trancheId, bool enabled) external onlyRole(GOV_ROLE) {
        _trancheRollingEnabled[trancheId] = enabled;
        emit TrancheRollingEnabledSet(trancheId, enabled);
    }

    /**
     * @notice Record a risk adjustment point for rolling average calculation
     * @param trancheId The tranche identifier
     * @param riskAdjBps Risk adjustment in basis points
     * @param timestamp Timestamp for the data point
     */
    function recordTrancheRiskPoint(uint256 trancheId, uint16 riskAdjBps, uint64 timestamp) external onlyRole(GOV_ROLE) {
        if (!_trancheRollingEnabled[trancheId]) revert BadParam(); // "Rolling: not enabled"
        if (riskAdjBps > maxBoundBps) revert BadParam(); // "Risk: exceeds max bound"
        
        _appendRollingPoint(trancheId, riskAdjBps, timestamp);
    }

    /**
     * @notice Internal function to append a data point to the rolling buffer
     * @param trancheId The tranche identifier
     * @param riskAdjBps Risk adjustment in basis points
     * @param timestamp Timestamp for the data point
     */
    function _appendRollingPoint(uint256 trancheId, uint16 riskAdjBps, uint64 timestamp) internal {
        RollingBuf storage buf = _trancheRollingData[trancheId];
        
        // Add new data point
        buf.buf[buf.index] = RiskPoint({
            riskAdjBps: riskAdjBps,
            timestamp: timestamp
        });
        
        // Update circular buffer index
        buf.index = (buf.index + 1) % 30;
        
        // Update count (capped at 30)
        if (buf.count < 30) {
            buf.count++;
        }
        
        emit TrancheRollingPointAppended(trancheId, riskAdjBps, timestamp);
    }

    /**
     * @notice Get rolling buffer head information for testing/telemetry
     * @param trancheId The tranche identifier
     * @return count Number of valid data points
     * @return index Current buffer index
     */
    function rollingHead(uint256 trancheId) external view returns (uint8 count, uint8 index) {
        RollingBuf storage buf = _trancheRollingData[trancheId];
        return (buf.count, buf.index);
    }

    /**
     * @notice Get a specific data point from the rolling buffer
     * @param trancheId The tranche identifier
     * @param bufIndex Buffer index (0-29)
     * @return riskAdjBps Risk adjustment in basis points
     * @return timestamp Timestamp of the data point
     */
    function getRollingDataPoint(uint256 trancheId, uint8 bufIndex) external view returns (uint16 riskAdjBps, uint64 timestamp) {
        require(bufIndex < 30, "Invalid buffer index");
        RollingBuf storage buf = _trancheRollingData[trancheId];
        RiskPoint memory point = buf.buf[bufIndex];
        return (point.riskAdjBps, point.timestamp);
    }
}
