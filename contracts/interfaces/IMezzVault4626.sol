// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IMezzVault4626 is IERC4626 {
    // State variables
    function minUnlockTs(address account) external view returns (uint256);
    function whitelist(address account) external view returns (bool);
    function configRegistry() external view returns (address);

    // View functions
    function minUnlockOf(address account) external view returns (uint256);
    function isLocked(address account) external view returns (bool);
    function canWithdraw(address account) external view returns (bool);

    // Governance functions
    function setConfigRegistry(address newRegistry) external;
    function setWhitelist(address account, bool whitelisted) external;
    function pause() external;
    function unpause() external;
    function forceUnlock(address[] calldata users) external;

    // Events
    event Locked(address indexed acct, uint256 newUnlockTs);
    event ForceUnlocked(address indexed acct);
    event WhitelistUpdated(address indexed acct, bool whitelisted);
    event ConfigRegistryUpdated(address indexed newRegistry);
}
