// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface INAVOracleV3 {
    // Read functions
    function latestNAVRay() external view returns (uint256);
    function lastUpdateTs() external view returns (uint256);
    function isEmergency() external view returns (bool);
    function modelHash() external view returns (bytes32);
    
    // Admin/ops functions
    function rotateSigners(address[] calldata newSigners) external;
    function updateQuorum(uint256 newQuorum) external;
    function rollModelHash(bytes32 newModelHash) external;
    function submitNAV(uint256 navRay, uint256 ts, bytes[] calldata sigs) external;
    function enableEmergencyNAV(uint256 emergencyNavRay) external;
    function disableEmergencyNAV() external;
}
