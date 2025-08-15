// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIssuanceControllerV3} from "../interfaces/IIssuanceControllerV3.sol";

/**
 * @title MockIssuanceController
 * @notice Mock issuance controller for testing
 */
contract MockIssuanceController is IIssuanceControllerV3 {
    bool public _canIssue = true;

    function setCanIssue(bool canIssue) external {
        _canIssue = canIssue;
    }

    function canIssue() external view override returns (bool) {
        return _canIssue;
    }

    function mintFor(
        address recipient,
        uint256 usdcAmount,
        uint256 tailCorrPpm,
        uint256 sovUtilBps
    ) external override {
        // Mock implementation - just emit an event
        emit MockMint(recipient, usdcAmount, tailCorrPpm, sovUtilBps);
    }

    event MockMint(
        address recipient,
        uint256 usdcAmount,
        uint256 tailCorrPpm,
        uint256 sovUtilBps
    );
}
