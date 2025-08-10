// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "./MemberRegistry.sol";
import "./ConfigRegistry.sol";

contract RedemptionClaim is ERC1155, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER");
    MemberRegistry public immutable registry;
    ConfigRegistry public immutable config;

    struct Claim { uint256 amount; uint256 strikeTs; bool settled; }
    mapping(uint256 => Claim) public claims;
    uint256 public nextId = 1;
    uint256 public freezeSecs = 24 hours;

    event ClaimMinted(uint256 indexed id, address indexed to, uint256 amount, uint256 strikeTs);
    event ClaimSettled(uint256 indexed id, address indexed holder);

    constructor(address gov, MemberRegistry _registry, ConfigRegistry _config)
        ERC1155("")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(ISSUER_ROLE, gov);
        registry = _registry;
        config = _config;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function mintClaim(address to, uint256 strikeTs, uint256 amount) external onlyRole(ISSUER_ROLE) {
        require(registry.isMember(to), "member");
        uint256 id = nextId++;
        claims[id] = Claim({amount: amount, strikeTs: strikeTs, settled: false});
        _mint(to, id, 1, "");
        emit ClaimMinted(id, to, amount, strikeTs);
    }

    function settleAndBurn(uint256 id, address holder) external onlyRole(ISSUER_ROLE) {
        Claim storage c = claims[id];
        require(!c.settled, "settled");
        c.settled = true;
        _burn(holder, id, 1);
        emit ClaimSettled(id, holder);
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 v, bytes memory data) public override {
        require(registry.isMember(to), "member");
        Claim memory c = claims[id];
        
        // Enhanced freeze rules based on emergency level
        ConfigRegistry.EmergencyLevel level = config.emergencyLevel();
        uint256 effectiveFreezeSecs = freezeSecs;
        
        if (level == ConfigRegistry.EmergencyLevel.ORANGE) {
            effectiveFreezeSecs = 48 hours; // Extended freeze in ORANGE
        } else if (level == ConfigRegistry.EmergencyLevel.RED) {
            effectiveFreezeSecs = 72 hours; // Extended freeze in RED
        }
        
        require(block.timestamp + effectiveFreezeSecs < c.strikeTs, "claim frozen pre-strike");
        super.safeTransferFrom(from, to, id, v, data);
    }
}
