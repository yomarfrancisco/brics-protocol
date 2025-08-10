// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ClaimRegistry
 * @dev Sovereign guarantee claim tracking and legal milestone management
 * @spec §7 Sovereign Guarantee Integration
 * @trace SPEC §7: Legal framework integration, claim lifecycle tracking, crisis expansion
 */

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract ClaimRegistry is AccessControl {
    bytes32 public constant GOV_ROLE = keccak256("GOV");
    bytes32 public constant ECC_ROLE = keccak256("ECC");
    bytes32 public constant OPS_ROLE = keccak256("OPS");

    // Claim lifecycle tracking
    struct ClaimDossier {
        bytes32 dossierHash;      // IPFS hash of claim documentation
        string jurisdiction;      // Sovereign jurisdiction
        uint256 triggerTs;        // T0: Trigger timestamp
        uint256 noticeTs;         // T0 + 7d: Notice served timestamp
        uint256 acknowledgmentTs; // Sovereign acknowledgment timestamp
        uint256 scheduledTs;      // Payment scheduled timestamp
        uint256 settlementTs;     // Final settlement timestamp
        uint256 baseLoss;         // L - FL - MZ
        uint256 coveredLoss;      // min(baseLoss, SG_avail)
        uint256 advanceAmount;    // Bridge advance amount
        string refNo;             // Sovereign reference number
        bool isActive;            // Claim is active
        bool isSettled;           // Claim is fully settled
    }

    // Sovereign guarantee parameters
    uint16 public constant MAX_DETACH_TIER1 = 10500; // 105%
    uint16 public constant MAX_DETACH_TIER2 = 10800; // 108% (optional)
    uint256 public constant IRB_RED_BPS = 1200;      // 12% IRB target in RED
    uint256 public constant PRE_BUFFER_RED_MIN = 8_000_000e6; // $8M minimum
    uint256 public constant ADVANCE_MIN_PCT = 5000;  // 50% minimum advance

    // Active claims tracking
    mapping(uint256 => ClaimDossier) public claims;
    uint256 public nextClaimId = 1;
    uint256 public activeClaimCount;

    // Sovereign guarantee state
    bool public sovereignGuaranteeConfirmed;
    uint256 public lastTriggerTs;
    string public lastTriggerReason;

    // Events for legal milestone tracking
    event NoticeServed(uint256 indexed claimId, bytes32 dossierHash, string jurisdiction, uint256 ts);
    event Acknowledged(uint256 indexed claimId, uint256 ts, string refNo);
    event ScheduledPayment(uint256 indexed claimId, uint256 ts, uint256 amount);
    event Settlement(uint256 indexed claimId, uint256 ts, uint256 amount, string refNo);
    event ClaimTriggered(uint256 indexed claimId, string reason, uint256 baseLoss, uint256 coveredLoss);
    event SovereignGuaranteeConfirmed(bool confirmed, string reason);

    // Custom errors
    error ClaimNotFound(uint256 claimId);
    error ClaimAlreadySettled(uint256 claimId);
    error InvalidMilestone();
    error InsufficientAdvance();
    error BufferTargetsNotMet();

    constructor(address gov) {
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
        _grantRole(ECC_ROLE, gov);
        _grantRole(OPS_ROLE, gov);
    }

    /**
     * @dev Trigger a sovereign guarantee claim (ECC_ROLE only)
     * @param dossierHash IPFS hash of claim documentation
     * @param jurisdiction Sovereign jurisdiction
     * @param baseLoss Calculated base loss (L - FL - MZ)
     * @param coveredLoss Eligible sovereign coverage
     * @param reason Trigger reason
     */
    function triggerClaim(
        bytes32 dossierHash,
        string calldata jurisdiction,
        uint256 baseLoss,
        uint256 coveredLoss,
        string calldata reason
    ) external onlyRole(ECC_ROLE) returns (uint256 claimId) {
        claimId = nextClaimId++;
        
        claims[claimId] = ClaimDossier({
            dossierHash: dossierHash,
            jurisdiction: jurisdiction,
            triggerTs: block.timestamp,
            noticeTs: 0,
            acknowledgmentTs: 0,
            scheduledTs: 0,
            settlementTs: 0,
            baseLoss: baseLoss,
            coveredLoss: coveredLoss,
            advanceAmount: 0,
            refNo: "",
            isActive: true,
            isSettled: false
        });

        activeClaimCount++;
        lastTriggerTs = block.timestamp;
        lastTriggerReason = reason;

        emit ClaimTriggered(claimId, reason, baseLoss, coveredLoss);
    }

    /**
     * @dev Serve formal notice to sovereign (OPS_ROLE only)
     * @param claimId Claim identifier
     * @param dossierHash Updated dossier hash
     */
    function serveNotice(uint256 claimId, bytes32 dossierHash) external onlyRole(OPS_ROLE) {
        ClaimDossier storage claim = claims[claimId];
        if (!claim.isActive || claim.isSettled) revert ClaimNotFound(claimId);
        if (claim.noticeTs != 0) revert InvalidMilestone();

        claim.noticeTs = block.timestamp;
        claim.dossierHash = dossierHash;

        emit NoticeServed(claimId, dossierHash, claim.jurisdiction, block.timestamp);
    }

    /**
     * @dev Record sovereign acknowledgment (OPS_ROLE only)
     * @param claimId Claim identifier
     * @param refNo Sovereign reference number
     */
    function recordAcknowledgment(uint256 claimId, string calldata refNo) external onlyRole(OPS_ROLE) {
        ClaimDossier storage claim = claims[claimId];
        if (!claim.isActive || claim.isSettled) revert ClaimNotFound(claimId);
        if (claim.noticeTs == 0) revert InvalidMilestone();

        claim.acknowledgmentTs = block.timestamp;
        claim.refNo = refNo;

        emit Acknowledged(claimId, block.timestamp, refNo);
    }

    /**
     * @dev Schedule payment (OPS_ROLE only)
     * @param claimId Claim identifier
     * @param amount Scheduled payment amount
     */
    function schedulePayment(uint256 claimId, uint256 amount) external onlyRole(OPS_ROLE) {
        ClaimDossier storage claim = claims[claimId];
        if (!claim.isActive || claim.isSettled) revert ClaimNotFound(claimId);
        if (claim.acknowledgmentTs == 0) revert InvalidMilestone();

        claim.scheduledTs = block.timestamp;
        claim.advanceAmount = amount;

        emit ScheduledPayment(claimId, block.timestamp, amount);
    }

    /**
     * @dev Record final settlement (OPS_ROLE only)
     * @param claimId Claim identifier
     * @param amount Settlement amount
     */
    function recordSettlement(uint256 claimId, uint256 amount) external onlyRole(OPS_ROLE) {
        ClaimDossier storage claim = claims[claimId];
        if (!claim.isActive || claim.isSettled) revert ClaimNotFound(claimId);

        claim.settlementTs = block.timestamp;
        claim.isSettled = true;
        activeClaimCount--;

        emit Settlement(claimId, block.timestamp, amount, claim.refNo);
    }

    /**
     * @dev Confirm sovereign guarantee availability (GOV_ROLE only)
     * @param confirmed Whether guarantee is confirmed
     * @param reason Confirmation reason
     */
    function confirmSovereignGuarantee(bool confirmed, string calldata reason) external onlyRole(GOV_ROLE) {
        sovereignGuaranteeConfirmed = confirmed;
        emit SovereignGuaranteeConfirmed(confirmed, reason);
    }

    /**
     * @dev Check if Tier 2 expansion (106-108%) is allowed
     * @param claimId Active claim ID
     * @param irbBalance Current IRB balance
     * @param preBufferBalance Current Pre-Tranche Buffer balance
     */
    function canExpandTier2(
        uint256 claimId,
        uint256 irbBalance,
        uint256 preBufferBalance
    ) external view returns (bool) {
        ClaimDossier storage claim = claims[claimId];
        if (!claim.isActive || claim.isSettled) return false;
        if (claim.noticeTs == 0) return false; // Notice must be served
        if (claim.advanceAmount < (claim.coveredLoss * ADVANCE_MIN_PCT) / 10000) return false; // Advance must be sufficient

        // Buffer targets must be met
        if (irbBalance < (claim.coveredLoss * IRB_RED_BPS) / 10000) return false;
        if (preBufferBalance < PRE_BUFFER_RED_MIN) return false;

        return true;
    }

    /**
     * @dev Get claim details
     * @param claimId Claim identifier
     */
    function getClaim(uint256 claimId) external view returns (ClaimDossier memory) {
        if (!claims[claimId].isActive && !claims[claimId].isSettled) revert ClaimNotFound(claimId);
        return claims[claimId];
    }

    /**
     * @dev Get active claim count
     */
    function getActiveClaimCount() external view returns (uint256) {
        return activeClaimCount;
    }

    /**
     * @dev Check if sovereign guarantee is available for crisis expansion
     */
    function isSovereignGuaranteeAvailable() external view returns (bool) {
        return sovereignGuaranteeConfirmed && activeClaimCount > 0;
    }
}
