// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract MezzanineVault is ERC4626, AccessControl {
    bytes32 public constant GOV_ROLE = keccak256("GOV");
    mapping(address => bool) public isWhitelisted;
    uint256 public reinvestUntil; // unix timestamp
    bool    public principalLocked;

    event Whitelist(address indexed who, bool ok);

    constructor(address gov, ERC20 asset_, uint256 reinvestUntil_)
        ERC20("BRICS Mezzanine Shares", "BRICS-MZ")
        ERC4626(asset_)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
        reinvestUntil = reinvestUntil_;
        principalLocked = true;
    }

    function setWhitelist(address who, bool ok) external onlyRole(GOV_ROLE) {
        isWhitelisted[who] = ok; emit Whitelist(who, ok);
    }

    function _checkWhitelist(address who) internal view {
        require(isWhitelisted[who], "not wl");
    }

    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        _checkWhitelist(msg.sender);
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override returns (uint256) {
        _checkWhitelist(msg.sender);
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256) {
        require(block.timestamp > reinvestUntil || !principalLocked, "reinvest lock");
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) public override returns (uint256) {
        require(block.timestamp > reinvestUntil || !principalLocked, "reinvest lock");
        return super.redeem(shares, receiver, owner);
    }
}
