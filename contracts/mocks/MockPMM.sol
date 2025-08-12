// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPMM} from "../interfaces/IPMM.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockPMM is IPMM {
    IERC20 public immutable usdc;
    uint256 private _bps; // 10_000 = 100%

    event Swapped(uint256 usdcIn, uint256 bps, uint256 usdcOut, address recipient);
    event PriceSet(uint256 bps);

    constructor(IERC20 _usdc) {
        usdc = _usdc;
        _bps = 10_000;
    }

    function setBps(uint256 newBps) external {
        require(newBps > 0, "PMM/INVALID_BPS");
        _bps = newBps;
        emit PriceSet(newBps);
    }

    function quoteBps() external view returns (uint256) {
        return _bps;
    }

    function swapAtBps(uint256 usdcIn, uint256 expectedBps, address recipient)
        external
        returns (uint256 usdcOut)
    {
        require(usdcIn > 0, "PMM/ZERO_IN");
        require(expectedBps == _bps, "PMM/PRICE_CHANGED");

        // Pull USDC from caller (lane must approve this PMM)
        require(usdc.transferFrom(msg.sender, address(this), usdcIn), "PMM/TRANSFER_IN");

        usdcOut = (usdcIn * _bps) / 10_000;

        require(usdc.transfer(recipient, usdcOut), "PMM/TRANSFER_OUT");
        emit Swapped(usdcIn, _bps, usdcOut, recipient);
    }
}
