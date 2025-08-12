// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IConfigRegistryLike} from "./interfaces/IConfigRegistryLike.sol";

/**
 * @title MezzVault4626
 * @dev ERC-4626 vault for mezzanine assets with 5-year lock and grace window
 */
contract MezzVault4626 is ERC4626, AccessControl, Pausable {
    bytes32 public constant GOV_ROLE = keccak256("GOV");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY");

    // Config keys
    bytes32 private constant K_LOCK_DURATION = keccak256("mezz.lock.durationSec");
    bytes32 private constant K_GRACE_WINDOW = keccak256("mezz.lock.graceSec");

    // Lock state
    mapping(address => uint256) public minUnlockTs;
    mapping(address => bool) public whitelist;

    // External dependencies
    IConfigRegistryLike public configRegistry;

    // Events
    event Locked(address indexed acct, uint256 newUnlockTs);
    event ForceUnlocked(address indexed acct);
    event WhitelistUpdated(address indexed acct, bool whitelisted);
    event ConfigRegistryUpdated(address indexed newRegistry);

    // Custom errors
    error MV_LOCKED();
    error MV_PAUSED();
    error MV_ZERO_ADDRESS();

    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        address _configRegistry
    ) ERC20(_name, _symbol) ERC4626(_asset) {
        if (address(_configRegistry) == address(0)) revert MV_ZERO_ADDRESS();
        
        configRegistry = IConfigRegistryLike(_configRegistry);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOV_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }

    modifier onlyGov() {
        require(hasRole(GOV_ROLE, msg.sender), "MV/ONLY_GOV");
        _;
    }

    modifier onlyEmergency() {
        require(hasRole(EMERGENCY_ROLE, msg.sender), "MV/ONLY_EMERGENCY");
        _;
    }

    // Override deposit functions to set lock
    function deposit(uint256 assets, address receiver) 
        public 
        virtual 
        override 
        whenNotPaused 
        returns (uint256 shares) 
    {
        shares = super.deposit(assets, receiver);
        _updateLock(receiver);
    }

    function mint(uint256 shares, address receiver) 
        public 
        virtual 
        override 
        whenNotPaused 
        returns (uint256 assets) 
    {
        assets = super.mint(shares, receiver);
        _updateLock(receiver);
    }

    // Override withdraw functions to check lock
    function withdraw(uint256 assets, address receiver, address owner) 
        public 
        virtual 
        override 
        whenNotPaused 
        returns (uint256 shares) 
    {
        _checkUnlock(owner);
        shares = super.withdraw(assets, receiver, owner);
        _handleGraceWindow(owner);
    }

    function redeem(uint256 shares, address receiver, address owner) 
        public 
        virtual 
        override 
        whenNotPaused 
        returns (uint256 assets) 
    {
        _checkUnlock(owner);
        assets = super.redeem(shares, receiver, owner);
        _handleGraceWindow(owner);
    }

    // View functions
    function minUnlockOf(address account) external view returns (uint256) {
        return minUnlockTs[account];
    }

    function isLocked(address account) external view returns (bool) {
        return block.timestamp < minUnlockTs[account] && !whitelist[account];
    }

    function canWithdraw(address account) external view returns (bool) {
        return block.timestamp >= minUnlockTs[account] || whitelist[account];
    }

    // Governance functions
    function setConfigRegistry(address newRegistry) external onlyGov {
        if (newRegistry == address(0)) revert MV_ZERO_ADDRESS();
        configRegistry = IConfigRegistryLike(newRegistry);
        emit ConfigRegistryUpdated(newRegistry);
    }

    function setWhitelist(address account, bool whitelisted) external onlyGov {
        whitelist[account] = whitelisted;
        emit WhitelistUpdated(account, whitelisted);
    }

    function pause() external onlyGov {
        _pause();
    }

    function unpause() external onlyGov {
        _unpause();
    }

    function forceUnlock(address[] calldata users) external onlyEmergency {
        for (uint256 i = 0; i < users.length; i++) {
            minUnlockTs[users[i]] = 0;
            emit ForceUnlocked(users[i]);
        }
    }

    // Internal functions
    function _updateLock(address account) internal {
        uint256 lockDuration = _getOrDefault(K_LOCK_DURATION, 5 * 365 * 24 * 60 * 60); // 5 years default
        uint256 newUnlockTs = block.timestamp + lockDuration;
        
        // Extend lock if new unlock time is later
        if (newUnlockTs > minUnlockTs[account]) {
            minUnlockTs[account] = newUnlockTs;
            emit Locked(account, newUnlockTs);
        }
    }

    function _checkUnlock(address account) internal view {
        // Allow if whitelisted or past unlock time
        if (whitelist[account] || block.timestamp >= minUnlockTs[account]) {
            return;
        }
        revert MV_LOCKED();
    }

    function _handleGraceWindow(address account) internal {
        uint256 graceWindow = _getOrDefault(K_GRACE_WINDOW, 30 * 24 * 60 * 60); // 30 days default
        
        // Check if within grace window and fully withdrawn
        if (block.timestamp <= minUnlockTs[account] + graceWindow && 
            balanceOf(account) == 0) {
            minUnlockTs[account] = 0;
        }
    }

    function _getOrDefault(bytes32 key, uint256 defaultValue) internal view returns (uint256) {
        try configRegistry.getUint(key) returns (uint256 value) {
            return value == 0 ? defaultValue : value;
        } catch {
            return defaultValue;
        }
    }
}
