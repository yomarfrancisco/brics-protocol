// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAMM} from "../interfaces/IAMM.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockAMM is IAMM {
    IERC20 public immutable usdc;
    uint256 private _priceBps; // 10_000 = 100%

    event Swapped(uint256 usdcIn, uint256 usdcOut, address to);
    event PriceSet(uint256 priceBps);

    constructor(IERC20 _usdc) {
        usdc = _usdc;
        _priceBps = 10_000; // par by default
    }

    function setPriceBps(uint256 newBps) external {
        require(newBps > 0, "AMM/INVALID_BPS");
        _priceBps = newBps;
        emit PriceSet(newBps);
    }

    function priceBps() external view returns (uint256) {
        return _priceBps;
    }

    function swap(uint256 usdcIn, address recipient) external returns (uint256 usdcOut) {
        require(usdcIn > 0, "AMM/ZERO_IN");
        // Pull USDC in
        require(usdc.transferFrom(msg.sender, address(this), usdcIn), "AMM/TRANSFER_IN");
        // Apply price BPS (slippage/fee)
        usdcOut = (usdcIn * _priceBps) / 10_000;
        // Pay out
        require(usdc.transfer(recipient, usdcOut), "AMM/TRANSFER_OUT");
        emit Swapped(usdcIn, usdcOut, recipient);
    }
}

