// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

library RiskSignalLib {
    struct Payload {
        bytes32 portfolioId;
        uint64  asOf;
        uint256 riskScore;
        uint16  correlationBps;
        uint16  spreadBps;
        bytes32 modelIdHash;   // keccak256(modelId)
        bytes32 featuresHash;  // keccak256(canonical features json)
    }

    function digest(Payload memory p) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            p.portfolioId,
            p.asOf,
            p.riskScore,
            p.correlationBps,
            p.spreadBps,
            p.modelIdHash,
            p.featuresHash
        ));
    }

    function recoverSigner(Payload memory p, bytes memory sig) internal pure returns (address) {
        bytes32 d = digest(p);
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(d); // EIP-191 prefix ONCE
        return ECDSA.recover(ethHash, sig);
    }
}
