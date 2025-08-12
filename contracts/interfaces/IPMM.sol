// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPMM {
    /// @notice Quote execution price in BPS (10_000 = 100%)
    function quoteBps() external view returns (uint256);

    /// @notice Execute swap at caller-provided expected bps (must match or revert)
    /// @dev Recipient receives USDC out. Implementation should verify expectedBps == current quote.
    function swapAtBps(uint256 usdcIn, uint256 expectedBps, address recipient) external returns (uint256 usdcOut);
}
