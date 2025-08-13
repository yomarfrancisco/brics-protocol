// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IConfigRegistryLike {
    function getUint(bytes32 key) external view returns (uint256);
}

