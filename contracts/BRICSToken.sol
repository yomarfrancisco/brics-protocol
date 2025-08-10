// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BRICSToken
 * @dev ERC-20 token with transfer restrictions and NAV redemption support
 * @spec §2 Membership & Transfer Control
 * @spec §4 NAV Redemption Lane
 * @trace SPEC §2: Transfer restrictions, membership checks
 * @trace SPEC §4: BURNER_ROLE executor (implemented), NAV window controls (TODO)
 */

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "./MemberRegistry.sol";

contract BRICSToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER");
    MemberRegistry public immutable registry;

    constructor(address gov, MemberRegistry _registry)
        ERC20("BRICS Super-Senior", "BRICS")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(MINTER_ROLE, gov);
        _grantRole(BURNER_ROLE, gov);
        registry = _registry;
    }

    function mint(address to, uint256 amt) external onlyRole(MINTER_ROLE) { _mint(to, amt); }
    function burn(address from, uint256 amt) external onlyRole(BURNER_ROLE) { _burn(from, amt); }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0)) require(registry.canSend(from), "sender not member/pool");
        if (to   != address(0)) require(registry.canReceive(to), "recipient not member/pool");
        super._update(from, to, value);
    }
}
