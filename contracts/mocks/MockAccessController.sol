// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockAccessController {
    mapping(bytes32 => mapping(address => bool)) public roles;

    function grantRole(bytes32 role, address account) external {
        roles[role][account] = true;
    }

    function revokeRole(bytes32 role, address account) external {
        roles[role][account] = false;
    }

    function hasRole(bytes32 role, address account) external view returns (bool) {
        return roles[role][account];
    }
}
