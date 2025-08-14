// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IIssuanceControllerV3 {
  function mintFor(address to, uint256 usdcAmt, uint256 tailCorrPpm, uint256 sovUtilBps, bytes32 sovereignCode) external;
}

contract IssuanceHarness {
  event Seen(address to, uint256 usdcAmt, uint256 tailCorrPpm, uint256 sovUtilBps, bytes32 sovereignCode);
  
  function proxyMint(IIssuanceControllerV3 ctrl, address to, uint256 usdcAmt, uint256 tailCorrPpm, uint256 sovUtilBps, bytes32 sovereignCode) external {
    emit Seen(to, usdcAmt, tailCorrPpm, sovUtilBps, sovereignCode);
    ctrl.mintFor(to, usdcAmt, tailCorrPpm, sovUtilBps, sovereignCode);
  }
}
