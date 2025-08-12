// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMemberRegistryLike {
    function isMember(address who) external view returns (bool);
}

contract MockMemberRegistry is IMemberRegistryLike {
    mapping(address => bool) public members;
    event MemberSet(address indexed who, bool isMember);

    function setMember(address who, bool v) external {
        members[who] = v;
        emit MemberSet(who, v);
    }

    function isMember(address who) external view returns (bool) {
        return members[who];
    }
}
