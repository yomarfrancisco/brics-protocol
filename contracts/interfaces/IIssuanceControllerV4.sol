// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIssuanceControllerV4 {
    // State variables
    function superSeniorCap() external view returns (uint256);
    function detachmentBps() external view returns (uint256);
    function lastDetachmentRaiseTs() external view returns (uint256);
    function issuanceLocked() external view returns (bool);
    function pendingRatifyUntil() external view returns (uint256);

    // Governance functions
    function setSuperSeniorCap(uint256 newCap) external;
    function raiseDetachment(uint256 newBps) external;
    function lowerDetachment(uint256 newBps) external;
    function ratifyDetachment() external;
    function lockIssuance() external;
    function unlockIssuance() external;
    function adjustByTriggers(uint256 currentDefaultsBps, uint256 sovereignUsageBps, uint256 correlationBps) external;

    // Mint gate function
    function checkMintAllowed(uint256 tokens) external view returns (bool);
    function canMint(uint256 tokens) external view returns (bool);
    function getCurrentState() external view returns (
        uint256 cap,
        uint256 detachment,
        bool locked,
        uint256 ratifyUntil,
        uint256 emergencyLevel
    );
}

