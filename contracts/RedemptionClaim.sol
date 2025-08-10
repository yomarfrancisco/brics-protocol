// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title RedemptionClaim
 * @dev ERC-1155 claims for monthly NAV redemptions with freeze period varying by emergency level
 * @spec §4 NAV Redemption Lane
 * @trace SPEC §4: NAV-based redemption claims, emergency level freeze rules, strike time management
 */

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "./MemberRegistry.sol";
import "./ConfigRegistry.sol";

contract RedemptionClaim is ERC1155, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER");
    MemberRegistry public immutable registry;
    ConfigRegistry public immutable config;

    struct Claim { 
        uint256 amount; 
        uint256 strikeTs; 
        bool settled; 
        address owner;
    }
    mapping(uint256 => Claim) public claims;
    uint256 public nextId = 1;
    uint256 public freezeSecs = 24 hours;

    event ClaimMinted(uint256 indexed id, address indexed to, uint256 amount, uint256 strikeTs);
    event ClaimSettled(uint256 indexed id, address indexed holder);
    event ClaimStrikeSet(uint256 indexed id, uint256 strikeTs);

    constructor(address gov, MemberRegistry _registry, ConfigRegistry _config)
        ERC1155("")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(ISSUER_ROLE, gov);
        _grantRole(BURNER_ROLE, gov);
        registry = _registry;
        config = _config;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function mintClaim(address to, uint256 strikeTs, uint256 amount) external onlyRole(ISSUER_ROLE) returns (uint256 id) {
        require(registry.isMember(to), "member");
        id = nextId++;
        claims[id] = Claim({
            amount: amount, 
            strikeTs: strikeTs, 
            settled: false,
            owner: to
        });
        _mint(to, id, 1, "");
        emit ClaimMinted(id, to, amount, strikeTs);
        return id;
    }

    function setStrikeTs(uint256 id, uint256 strikeTs) external onlyRole(ISSUER_ROLE) {
        Claim storage c = claims[id];
        require(!c.settled, "settled");
        c.strikeTs = strikeTs;
        emit ClaimStrikeSet(id, strikeTs);
    }

    function settleAndBurn(uint256 id, address holder) external onlyRole(BURNER_ROLE) {
        Claim storage c = claims[id];
        require(!c.settled, "settled");
        require(c.owner == holder, "not owner");
        c.settled = true;
        _burn(holder, id, 1);
        emit ClaimSettled(id, holder);
    }

    function claimInfo(uint256 id) external view returns (address owner, uint256 amount, uint256 strikeTs, bool settled) {
        Claim storage c = claims[id];
        return (c.owner, c.amount, c.strikeTs, c.settled);
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 v, bytes memory data) public override {
        require(registry.isMember(to), "member");
        Claim memory c = claims[id];
        
        // Enhanced freeze rules based on emergency level
        uint8 level = uint8(config.emergencyLevel());
        uint256 effectiveFreezeSecs = freezeSecs;
        
        if (level == 2) { // ORANGE
            effectiveFreezeSecs = 48 hours; // Extended freeze in ORANGE
        } else if (level == 3) { // RED
            effectiveFreezeSecs = 72 hours; // Extended freeze in RED
        }
        
        require(block.timestamp + effectiveFreezeSecs < c.strikeTs, "claim frozen pre-strike");
        super.safeTransferFrom(from, to, id, v, data);
    }
}
