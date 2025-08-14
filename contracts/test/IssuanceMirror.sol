// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IIssuance {
  // Exact signature from implementation
  function mintFor(address,uint256,uint256,uint256,bytes32) external;
}

contract IssuanceMirror {
  event MirrorArgs(address to, uint256 usdcAmt, uint256 minOut, uint256 trancheId, bytes32 sovereign);
  
  function encodeArgs(address to, uint256 usdcAmt, uint256 minOut, uint256 trancheId, bytes32 sov) external pure returns (bytes memory) {
    return abi.encodeWithSelector(IIssuance.mintFor.selector, to, usdcAmt, minOut, trancheId, sov);
  }
  
  function echo(address to, uint256 usdcAmt, uint256 minOut, uint256 trancheId, bytes32 sov) external {
    emit MirrorArgs(to, usdcAmt, minOut, trancheId, sov);
  }
}
