// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MalUSDC
 * @dev Malicious USDC contract for testing reentrancy protection
 * Attempts to reenter the IssuanceController during transferFrom
 */
contract MalUSDC is ERC20 {
    address public targetContract;
    bytes public reentrantCall;
    bool public shouldReenter;
    uint256 public reentrantCount;

    constructor() ERC20("Malicious USDC", "mUSDC") {
        _mint(msg.sender, 1000000 * 10**6); // 1M USDC
    }

    function setReentrantTarget(address _target, bytes calldata _call) external {
        targetContract = _target;
        reentrantCall = _call;
    }

    function setShouldReenter(bool _should) external {
        shouldReenter = _should;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        bool success = super.transferFrom(from, to, amount);
        
        // Attempt reentrant call if enabled and target is set
        if (shouldReenter && targetContract != address(0) && reentrantCount < 3) {
            reentrantCount++;
            (bool callSuccess,) = targetContract.call(reentrantCall);
            // Don't revert on reentrant call failure - just log it
        }
        
        return success;
    }

    function decimals() public view virtual override returns (uint8) {
        return 6; // USDC decimals
    }
}
