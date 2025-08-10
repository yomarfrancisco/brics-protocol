// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract SovereignClaimToken is ERC721, AccessControl {
    bytes32 public constant GOV_ROLE = keccak256("GOV");

    uint256 public immutable claimId = 1;
    bool    public unlocked;

    error NonTransferable();

    event ClaimUnlocked(uint256 id, string reason);
    event ClaimExercised(uint256 id, uint256 amount, address to);

    constructor(address gov) ERC721("Sovereign Backstop Claim", "BRICS-SBT") {
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
        _safeMint(gov, claimId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        // Allow mint (from == address(0)) and burn (to == address(0)).
        // Disallow transfers to a new owner. Permit no-op self-transfers.
        if (to != address(0)) {
            address from = _ownerOf(tokenId);
            if (from != address(0) && to != from) revert NonTransferable();
        }
        return super._update(to, tokenId, auth);
    }

    function unlockClaim(string calldata reason) external onlyRole(GOV_ROLE) {
        unlocked = true; emit ClaimUnlocked(claimId, reason);
    }

    function exercise(uint256 amount, address to) external onlyRole(GOV_ROLE) {
        require(unlocked, "locked");
        emit ClaimExercised(claimId, amount, to);
        // off-chain legal execution and eventual funding settle to Treasury
    }
}
