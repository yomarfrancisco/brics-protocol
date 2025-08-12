// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISovereignClaimSBT {
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

    // Events
    event Filed(uint256 indexed tokenId, uint256 redemptionId, uint256 usdcNotional);
    event Acknowledged(uint256 indexed tokenId);
    event PaidToSPV(uint256 indexed tokenId, uint256 usdcPaid);
    event Reimbursed(uint256 indexed tokenId, uint256 usdcReimbursed);
    event Closed(uint256 indexed tokenId);
    event URISet(uint256 indexed tokenId, string uri);
    event HashesSet(uint256 indexed tokenId, bytes32 isdaAnnexHash, bytes32 docsBundleHash);

    // Core lifecycle functions
    function fileClaim(
        address to,
        uint256 redemptionId,
        uint256 usdcNotional,
        bytes32 isdaAnnexHash,
        bytes32 docsBundleHash,
        string calldata evidenceURI
    ) external returns (uint256 tokenId);

    function acknowledge(uint256 tokenId) external;
    function markPaidToSPV(uint256 tokenId, uint256 usdcPaid) external;
    function markReimbursed(uint256 tokenId, uint256 usdcReimbursed) external;
    function close(uint256 tokenId) external;

    // Metadata functions
    function setHashes(uint256 tokenId, bytes32 isdaAnnexHash, bytes32 docsBundleHash) external;
    function setEvidenceURI(uint256 tokenId, string calldata uri) external;

    // Burn function
    function burn(uint256 tokenId) external;

    // View functions
    function getClaim(uint256 tokenId) external view returns (Claim memory);
    function getStatus(uint256 tokenId) external view returns (ClaimStatus);
    function getRedemptionId(uint256 tokenId) external view returns (uint256);
    function getUsdcNotional(uint256 tokenId) external view returns (uint256);

    // Governance functions
    function pause() external;
    function unpause() external;
    function setBaseURI(string memory baseURI) external;

    // Soulbound enforcement
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) external;
}
