// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IIssuanceControllerV3
 * @notice Interface for issuance controller
 */
interface IIssuanceControllerV3 {
    /**
     * @notice Check if issuance is allowed
     * @return True if issuance is allowed
     */
    function canIssue() external view returns (bool);

    /**
     * @notice Mint tokens for a recipient
     * @param recipient Recipient address
     * @param usdcAmount USDC amount
     * @param tailCorrPpm Tail correlation in parts per million
     * @param sovUtilBps Sovereign utilization in basis points
     */
    function mintFor(
        address recipient,
        uint256 usdcAmount,
        uint256 tailCorrPpm,
        uint256 sovUtilBps
    ) external;
}

