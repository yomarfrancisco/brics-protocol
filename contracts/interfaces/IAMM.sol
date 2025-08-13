// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAMM {
    /// @notice Quote price for USDC-in -> USDC-out, expressed in BPS (10_000 = 100%)
    /// Example: priceBps = 9_950 means 0.5% fee/impact (out = in * 9950 / 10000)
    function priceBps() external view returns (uint256);

    /// @notice Perform a swap of USDC in for USDC out (could be the same token in mock)
    /// @dev For simplicity in mocks, in==out denomination. Real AMM would return different asset.
    function swap(uint256 usdcIn, address recipient) external returns (uint256 usdcOut);
}

