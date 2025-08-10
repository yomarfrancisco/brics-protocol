// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Treasury is AccessControl {
    using SafeERC20 for IERC20;
    bytes32 public constant GOV_ROLE = keccak256("GOV");
    bytes32 public constant PAY_ROLE = keccak256("PAY");

    IERC20 public immutable token; // USDC
    uint256 public bufferTargetBps;

    event Funded(address indexed token, uint256 amount);
    event Paid(address indexed token, address indexed to, uint256 amount);
    event BufferTargetSet(uint256 bps);

    constructor(address gov, IERC20 usdc, uint256 targetBps) {
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
        _grantRole(PAY_ROLE, gov);
        token = usdc;
        bufferTargetBps = targetBps;
    }

    function setBufferTargetBps(uint256 bps) external onlyRole(GOV_ROLE) {
        bufferTargetBps = bps; emit BufferTargetSet(bps);
    }

    function fund(uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(address(token), amount);
    }

    function pay(address to, uint256 amount) external onlyRole(PAY_ROLE) {
        token.safeTransfer(to, amount); emit Paid(address(token), to, amount);
    }

    function balance() external view returns (uint256) { return token.balanceOf(address(this)); }
}
