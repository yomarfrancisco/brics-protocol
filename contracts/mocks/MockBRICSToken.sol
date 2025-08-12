// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBRICSToken} from "../interfaces/IBRICSToken.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockBRICSToken
 * @notice Mock BRICS token for testing
 */
contract MockBRICSToken is IBRICSToken, ERC20 {
    constructor() ERC20("Mock BRICS", "mBRICS") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function totalSupply() public view override(ERC20, IBRICSToken) returns (uint256) {
        return super.totalSupply();
    }

    function burnFrom(address from, uint256 amount) external override {
        _burn(from, amount);
    }
}
