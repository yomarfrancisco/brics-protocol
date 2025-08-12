// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { RiskSignalLib } from "../libraries/RiskSignalLib.sol";

contract RiskSignalDebug {
    function digest(
        bytes32 portfolioId,
        uint64 asOf,
        uint256 riskScore,
        uint16 correlationBps,
        uint16 spreadBps,
        bytes32 modelIdHash,
        bytes32 featuresHash
    ) external pure returns (bytes32) {
        return RiskSignalLib.digest(
            RiskSignalLib.Payload({
                portfolioId: portfolioId,
                asOf: asOf,
                riskScore: riskScore,
                correlationBps: correlationBps,
                spreadBps: spreadBps,
                modelIdHash: modelIdHash,
                featuresHash: featuresHash
            })
        );
    }

    function recover(
        bytes32 digest_,
        bytes memory sig
    ) external pure returns (address) {
        // Mirrors CdsSwapEngine.verifyQuote() recovery step
        return RiskSignalLib.recoverSigner(
            RiskSignalLib.Payload({
                portfolioId: bytes32(0),  // ignored in this variant
                asOf: 0,
                riskScore: 0,
                correlationBps: 0,
                spreadBps: 0,
                modelIdHash: bytes32(0),
                featuresHash: bytes32(0)
            }),
            // we only use the utility, not the payload fields, for recovery eq.
            // (recoverSigner hashes its own payload; we'll use digest() directly below in TS)
            sig
        );
    }
}
