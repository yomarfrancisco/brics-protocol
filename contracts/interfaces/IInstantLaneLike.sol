// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IInstantLaneLike {
    function canInstantRedeem(address member, uint256 tokens18) external view returns (bool ok, uint256 capUSDC, uint256 usedUSDC, uint256 needUSDC);
    function instantRedeem(uint256 tokens18) external returns (uint256 usdcOut);
    function instantRedeemFor(address member, uint256 tokens18) external returns (uint256 usdcOut);
}
