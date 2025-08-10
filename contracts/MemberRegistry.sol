// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MemberRegistry
 * @dev Membership gating and pool whitelisting for transfer control
 * @spec §2 Membership & Transfer Control
 * @trace SPEC §2: Membership checks, pool whitelisting, canSend/canReceive
 */

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract MemberRegistry is AccessControl {
    bytes32 public constant REGISTRY_ADMIN = keccak256("REGISTRY_ADMIN");
    address public registrar; // OperationalAgreement

    mapping(address => bool) public isMember;
    mapping(address => bool) public isWhitelistedPool;

    event MemberSet(address indexed user, bool ok);
    event PoolSet(address indexed pool, bool ok);
    event RegistrarSet(address indexed registrar_);

    constructor(address gov) { _grantRole(DEFAULT_ADMIN_ROLE, gov); }

    function setRegistrar(address r) external onlyRole(DEFAULT_ADMIN_ROLE) {
        registrar = r; emit RegistrarSet(r);
    }

    modifier onlyRegistrar() { require(msg.sender == registrar, "only registrar"); _; }

    function setMember(address user, bool ok) external onlyRegistrar { isMember[user] = ok; emit MemberSet(user, ok); }
    function setPool(address pool, bool ok)   external onlyRegistrar { isWhitelistedPool[pool] = ok; emit PoolSet(pool, ok); }

    function canReceive(address to) external view returns (bool) { return isMember[to] || isWhitelistedPool[to]; }
    function canSend(address from)  external view returns (bool) { return isMember[from] || isWhitelistedPool[from]; }
}
