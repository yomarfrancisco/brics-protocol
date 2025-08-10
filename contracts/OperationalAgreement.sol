// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "./MemberRegistry.sol";

error Unauthorized();
error ZeroAddress();

contract OperationalAgreement is AccessControl {
    bytes32 public constant NASASA_ROLE   = keccak256("NASASA_ROLE");
    bytes32 public constant SPV_ROLE      = keccak256("SPV_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    MemberRegistry public registry;

    event MemberApproved(address indexed user);
    event MemberRevoked(address indexed user);
    event PoolWhitelisted(address indexed pool, bool ok);
    event OperatorSet(address indexed op, bool ok);

    constructor(address nasasa, address spv, MemberRegistry _registry) {
        if (nasasa == address(0) || spv == address(0) || address(_registry) == address(0)) {
            revert ZeroAddress();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, spv);
        _grantRole(NASASA_ROLE, nasasa);
        _grantRole(SPV_ROLE, spv);
        registry = _registry;
    }

    modifier onlyOps() {
        if (
            !hasRole(NASASA_ROLE, msg.sender) &&
            !hasRole(SPV_ROLE, msg.sender) &&
            !hasRole(OPERATOR_ROLE, msg.sender)
        ) revert Unauthorized();
        _;
    }

    function setOperator(address op, bool ok) external onlyRole(SPV_ROLE) {
        if (op == address(0)) revert ZeroAddress();
        if (ok) _grantRole(OPERATOR_ROLE, op); else _revokeRole(OPERATOR_ROLE, op);
        emit OperatorSet(op, ok);
    }

    function approveMember(address user) external onlyOps {
        if (user == address(0)) revert ZeroAddress();
        registry.setMember(user, true); emit MemberApproved(user);
    }

    function revokeMember(address user) external onlyOps {
        if (user == address(0)) revert ZeroAddress();
        registry.setMember(user, false); emit MemberRevoked(user);
    }

    function whitelistPool(address pool, bool ok) external onlyOps {
        if (pool == address(0)) revert ZeroAddress();
        registry.setPool(pool, ok); emit PoolWhitelisted(pool, ok);
    }
}
