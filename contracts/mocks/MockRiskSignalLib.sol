// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/RiskSignalLib.sol";

/**
 * @title MockRiskSignalLib
 * @notice Mock contract to expose RiskSignalLib functions for testing
 */
contract MockRiskSignalLib {
    function digest(RiskSignalLib.Payload memory p) external pure returns (bytes32) {
        return RiskSignalLib.digest(p);
    }

    function recoverSigner(bytes32 digest, bytes calldata signature) external pure returns (address) {
        return RiskSignalLib.recoverSigner(digest, signature);
    }
}
