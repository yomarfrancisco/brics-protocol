// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TreasuryLiquidityMock {
    IERC20 public immutable usdc;
    uint256 private _irbTarget;

    constructor(IERC20 _usdc) { usdc = _usdc; }

    function setIRBTarget(uint256 v) external { _irbTarget = v; }

    // Controller reads only irbTarget (third value) and ignores others.
    function getLiquidityStatus() external view returns (uint256, uint256, uint256, uint256, uint256) {
        return (0, 0, _irbTarget, 0, 0);
    }

    function pay(address to, uint256 amt) external { usdc.transfer(to, amt); }
    function balance() external view returns (uint256) { return usdc.balanceOf(address(this)); }
}
