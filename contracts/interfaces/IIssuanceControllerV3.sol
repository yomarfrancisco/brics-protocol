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
     * @param to Recipient address
     * @param usdcAmt USDC amount
     * @param tailCorrPpm Tail correlation in parts per million
     * @param sovUtilBps Sovereign utilization in basis points
     * @param sovereignCode Sovereign code identifier
     */
    function mintFor(
        address to,
        uint256 usdcAmt,
        uint256 tailCorrPpm,
        uint256 sovUtilBps,
        bytes32 sovereignCode
    ) external;
}

