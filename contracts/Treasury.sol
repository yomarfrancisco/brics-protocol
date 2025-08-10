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
    
    // SPEC §9: Enhanced Buffer Coordination Events
    event BufferShortfall(uint256 level, uint256 target, uint256 balance);
    event BufferRestored(uint256 level, uint256 balance);
    event AutoPauseTriggered(uint256 level, uint256 shortfallBps);

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
    
    // SPEC §9: Enhanced Buffer Coordination
    function getLiquidityStatus() external view returns (
        uint256 preTranche,
        uint256 irbBalance,
        uint256 irbTarget,
        uint256 shortfallBps,
        bool healthy
    ) {
        irbBalance = token.balanceOf(address(this));
        irbTarget = bufferTargetBps;
        
        // Calculate shortfall in basis points (0 = no shortfall, 10000 = 100% shortfall)
        if (irbBalance >= irbTarget) {
            shortfallBps = 0;
            healthy = true;
        } else {
            shortfallBps = ((irbTarget - irbBalance) * 10000) / irbTarget;
            healthy = false;
        }
        
        // For now, preTranche is 0 - will be updated when we integrate with PreTrancheBuffer
        preTranche = 0;
        
        return (preTranche, irbBalance, irbTarget, shortfallBps, healthy);
    }
}
