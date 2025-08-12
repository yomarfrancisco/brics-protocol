// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title SovereignClaimSBT
 * @dev Non-transferable ERC-721 SBT for notarizing sovereign draws/claims
 * Soulbound token with lifecycle management for sovereign guarantee claims
 * Links to RedemptionQueue claims and anchors off-chain ISDA/PFMA documentation
 */
contract SovereignClaimSBT is ERC721, AccessControl, Pausable {
    using Strings for uint256;

    bytes32 public constant GOV_ROLE = keccak256("GOV");
    bytes32 public constant SOV_ROLE = keccak256("SOV");
    bytes32 public constant ECC_ROLE = keccak256("ECC");

    enum ClaimStatus { 
        Filed, 
        Acknowledged, 
        PaidToSPV, 
        ReimbursedBySovereign, 
        Closed 
    }

    struct Claim {
        uint256 redemptionId;      // link to RedemptionQueue claimId
        uint256 usdcNotional;      // requested/paid amount (6d)
        uint64  filedAt;
        uint64  ackAt;
        uint64  paidAt;
        uint64  reimbursedAt;
        uint64  closedAt;
        bytes32 isdaAnnexHash;     // hash(anchor) of signed annex/amendment
        bytes32 docsBundleHash;    // hash of evidence pack (PDF bundle, DocuSign, etc.)
        string  evidenceURI;       // optional ipfs:// or https:// (can be empty)
        ClaimStatus status;
    }

    // State variables
    uint256 private _tokenIdCounter;
    mapping(uint256 => Claim) private _claims;
    string private _baseTokenURI;

    // Events
    event Filed(uint256 indexed tokenId, uint256 redemptionId, uint256 usdcNotional);
    event Acknowledged(uint256 indexed tokenId);
    event PaidToSPV(uint256 indexed tokenId, uint256 usdcPaid);
    event Reimbursed(uint256 indexed tokenId, uint256 usdcReimbursed);
    event Closed(uint256 indexed tokenId);
    event URISet(uint256 indexed tokenId, string uri);
    event HashesSet(uint256 indexed tokenId, bytes32 isdaAnnexHash, bytes32 docsBundleHash);

    // Custom errors
    error SBT_ONLY_FORWARD();
    error SBT_ONLY_ROLE();
    error SBT_NOT_OWNER_OR_GOV();
    error SBT_INVALID_INIT();
    error SBT_NO_TRANSFER();
    error SBT_INVALID_STATUS();

    constructor(
        string memory name,
        string memory symbol,
        address admin
    ) ERC721(name, symbol) {
        if (admin == address(0)) revert SBT_INVALID_INIT();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOV_ROLE, admin);
        _tokenIdCounter = 1;
    }

    // Modifiers
    modifier onlyForward(ClaimStatus currentStatus, ClaimStatus newStatus) {
        if (uint8(newStatus) <= uint8(currentStatus)) revert SBT_ONLY_FORWARD();
        _;
    }

    modifier onlyStatus(uint256 tokenId, ClaimStatus requiredStatus) {
        if (_claims[tokenId].status != requiredStatus) revert SBT_INVALID_STATUS();
        _;
    }

    modifier onlyStatusRange(uint256 tokenId, ClaimStatus minStatus, ClaimStatus maxStatus) {
        ClaimStatus currentStatus = _claims[tokenId].status;
        if (uint8(currentStatus) < uint8(minStatus) || uint8(currentStatus) > uint8(maxStatus)) {
            revert SBT_INVALID_STATUS();
        }
        _;
    }

    // Core lifecycle functions
    function fileClaim(
        address to,
        uint256 redemptionId,
        uint256 usdcNotional,
        bytes32 isdaAnnexHash,
        bytes32 docsBundleHash,
        string calldata evidenceURI
    ) external whenNotPaused returns (uint256 tokenId) {
        if (!hasRole(GOV_ROLE, msg.sender) && !hasRole(ECC_ROLE, msg.sender)) {
            revert SBT_ONLY_ROLE();
        }

        tokenId = _tokenIdCounter++;
        
        _claims[tokenId] = Claim({
            redemptionId: redemptionId,
            usdcNotional: usdcNotional,
            filedAt: uint64(block.timestamp),
            ackAt: 0,
            paidAt: 0,
            reimbursedAt: 0,
            closedAt: 0,
            isdaAnnexHash: isdaAnnexHash,
            docsBundleHash: docsBundleHash,
            evidenceURI: evidenceURI,
            status: ClaimStatus.Filed
        });

        _safeMint(to, tokenId);
        emit Filed(tokenId, redemptionId, usdcNotional);
    }

    function acknowledge(uint256 tokenId) external whenNotPaused {
        if (!hasRole(SOV_ROLE, msg.sender)) revert SBT_ONLY_ROLE();
        
        Claim storage claim = _claims[tokenId];
        if (uint8(claim.status) >= uint8(ClaimStatus.Acknowledged)) {
            revert SBT_ONLY_FORWARD();
        }
        
        claim.status = ClaimStatus.Acknowledged;
        claim.ackAt = uint64(block.timestamp);
        
        emit Acknowledged(tokenId);
    }

    function markPaidToSPV(uint256 tokenId, uint256 usdcPaid) external whenNotPaused {
        if (!hasRole(SOV_ROLE, msg.sender)) revert SBT_ONLY_ROLE();
        
        Claim storage claim = _claims[tokenId];
        if (uint8(claim.status) < uint8(ClaimStatus.Acknowledged)) {
            revert SBT_ONLY_FORWARD();
        }
        if (uint8(claim.status) >= uint8(ClaimStatus.PaidToSPV)) {
            revert SBT_ONLY_FORWARD();
        }
        
        claim.status = ClaimStatus.PaidToSPV;
        claim.paidAt = uint64(block.timestamp);
        
        emit PaidToSPV(tokenId, usdcPaid);
    }

    function markReimbursed(uint256 tokenId, uint256 usdcReimbursed) external whenNotPaused {
        if (!hasRole(SOV_ROLE, msg.sender) && !hasRole(GOV_ROLE, msg.sender)) {
            revert SBT_ONLY_ROLE();
        }
        
        Claim storage claim = _claims[tokenId];
        if (uint8(claim.status) < uint8(ClaimStatus.PaidToSPV)) {
            revert SBT_ONLY_FORWARD();
        }
        if (uint8(claim.status) >= uint8(ClaimStatus.ReimbursedBySovereign)) {
            revert SBT_ONLY_FORWARD();
        }
        
        claim.status = ClaimStatus.ReimbursedBySovereign;
        claim.reimbursedAt = uint64(block.timestamp);
        
        emit Reimbursed(tokenId, usdcReimbursed);
    }

    function close(uint256 tokenId) external whenNotPaused {
        if (!hasRole(GOV_ROLE, msg.sender)) revert SBT_ONLY_ROLE();
        
        Claim storage claim = _claims[tokenId];
        if (uint8(claim.status) < uint8(ClaimStatus.ReimbursedBySovereign)) {
            revert SBT_ONLY_FORWARD();
        }
        
        claim.status = ClaimStatus.Closed;
        claim.closedAt = uint64(block.timestamp);
        
        emit Closed(tokenId);
    }

    // Metadata functions
    function setHashes(
        uint256 tokenId,
        bytes32 isdaAnnexHash,
        bytes32 docsBundleHash
    ) external whenNotPaused onlyStatusRange(tokenId, ClaimStatus.Filed, ClaimStatus.Acknowledged) {
        if (!hasRole(GOV_ROLE, msg.sender)) revert SBT_ONLY_ROLE();
        
        Claim storage claim = _claims[tokenId];
        claim.isdaAnnexHash = isdaAnnexHash;
        claim.docsBundleHash = docsBundleHash;
        
        emit HashesSet(tokenId, isdaAnnexHash, docsBundleHash);
    }

    function setEvidenceURI(uint256 tokenId, string calldata uri) external whenNotPaused {
        if (!hasRole(GOV_ROLE, msg.sender)) revert SBT_ONLY_ROLE();
        
        _claims[tokenId].evidenceURI = uri;
        emit URISet(tokenId, uri);
    }

    // Burn function
    function burn(uint256 tokenId) external {
        Claim storage claim = _claims[tokenId];
        
        if (claim.status != ClaimStatus.Closed) revert SBT_ONLY_FORWARD();
        
        if (!hasRole(GOV_ROLE, msg.sender) && ownerOf(tokenId) != msg.sender) {
            revert SBT_NOT_OWNER_OR_GOV();
        }
        
        _burn(tokenId);
        delete _claims[tokenId];
    }

    // View functions
    function getClaim(uint256 tokenId) external view returns (Claim memory) {
        return _claims[tokenId];
    }

    function getStatus(uint256 tokenId) external view returns (ClaimStatus) {
        return _claims[tokenId].status;
    }

    function getRedemptionId(uint256 tokenId) external view returns (uint256) {
        return _claims[tokenId].redemptionId;
    }

    function getUsdcNotional(uint256 tokenId) external view returns (uint256) {
        return _claims[tokenId].usdcNotional;
    }

    // Governance functions
    function pause() external onlyRole(GOV_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GOV_ROLE) {
        _unpause();
    }

    // --- Soulbound enforcement: block *all* transfers/approvals ---
    function approve(address, uint256) public pure override {
        revert("SBT/NO_TRANSFER");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("SBT/NO_TRANSFER");
    }

    function transferFrom(address, address, uint256) public pure override {
        revert("SBT/NO_TRANSFER");
    }

    // OZ ERC721 exposes BOTH overloads; override the virtual one
    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("SBT/NO_TRANSFER");
    }

    // ERC721 overrides
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string memory baseURI) external onlyRole(GOV_ROLE) {
        _baseTokenURI = baseURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        string memory baseURI = _baseURI();
        if (bytes(baseURI).length == 0) {
            return "";
        }
        
        return string(abi.encodePacked(baseURI, tokenId.toString()));
    }

    // AccessControl overrides
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
