// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MalTreasury {
    function pay(address /*to*/, uint256 /*amount*/) external pure returns (bool) {
        revert("malicious pay revert");
    }
}
