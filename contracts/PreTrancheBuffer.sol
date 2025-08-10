// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MemberRegistry.sol";
import "./ConfigRegistry.sol";

contract PreTrancheBuffer is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Custom errors
    error NotMember();
    error ExceedsCapacity();
    error InsufficientBuffer();
    error ZeroAddress();
    error AmountZero();

    bytes32 public constant GOV_ROLE = keccak256("GOV");
    bytes32 public constant BUFFER_MANAGER = keccak256("BUFFER_MANAGER");

    IERC20 public immutable usdc;
    MemberRegistry public immutable registry;
    ConfigRegistry public immutable config;

    // Governance target (mutable)
    uint256 public targetBuffer = 10_000_000e6; // $10M USDC

    // Base per-member cap; may be throttled under emergency (see _effectiveDailyCap)
    uint256 public dailyInstantCapPerMember = 50_000e6; // $50K per member per day

    mapping(address => uint256) public lastRedemptionDay;
    mapping(address => uint256) public dailyRedemptionUsed;

    event BufferFunded(address indexed funder, uint256 amount);
    event InstantRedemption(address indexed user, uint256 amount);
    event DailyCapUpdated(uint256 newCap);
    event BufferTargetUpdated(uint256 newTarget);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event Synced(uint256 newBalance);

    constructor(
        address gov,
        IERC20 _usdc,
        MemberRegistry _registry,
        ConfigRegistry _config
    ) {
        if (gov == address(0)) revert ZeroAddress();
        if (address(_usdc) == address(0)) revert ZeroAddress();
        if (address(_registry) == address(0)) revert ZeroAddress();
        if (address(_config) == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
        _grantRole(BUFFER_MANAGER, gov);

        usdc = _usdc;
        registry = _registry;
        config = _config;
    }

    // Views
    function bufferBalance() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function _effectiveDailyCap() internal view returns (uint256 cap) {
        cap = dailyInstantCapPerMember;
        ConfigRegistry.EmergencyLevel level = config.emergencyLevel();
        if (level == ConfigRegistry.EmergencyLevel.ORANGE) {
            cap = cap / 2;
        } else if (level == ConfigRegistry.EmergencyLevel.RED) {
            cap = cap / 4;
        }
    }

    function availableInstantCapacity(address user) public view returns (uint256) {
        if (!registry.isMember(user)) revert NotMember();

        uint256 today = block.timestamp / 1 days;
        uint256 cap = _effectiveDailyCap();
        uint256 buf = bufferBalance();

        if (lastRedemptionDay[user] != today) {
            return _min(cap, buf);
        }

        uint256 used = dailyRedemptionUsed[user];
        if (used >= cap) return 0;
        uint256 remainingDaily = cap - used;
        return _min(remainingDaily, buf);
    }

    // State changes
    function fundBuffer(uint256 amount) external nonReentrant {
        if (amount == 0) revert AmountZero();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit BufferFunded(msg.sender, amount);
        emit Synced(bufferBalance());
    }

    function instantRedeem(address user, uint256 amount) external onlyRole(BUFFER_MANAGER) nonReentrant {
        if (!registry.isMember(user)) revert NotMember();
        if (amount == 0) revert AmountZero();

        uint256 capacity = availableInstantCapacity(user);
        if (amount > capacity) revert ExceedsCapacity();

        uint256 bal = bufferBalance();
        if (bal < amount) revert InsufficientBuffer();

        uint256 today = block.timestamp / 1 days;
        if (lastRedemptionDay[user] != today) {
            lastRedemptionDay[user] = today;
            dailyRedemptionUsed[user] = 0;
        }
        dailyRedemptionUsed[user] += amount;

        usdc.safeTransfer(user, amount);
        emit InstantRedemption(user, amount);
        emit Synced(bufferBalance());
    }

    function setDailyInstantCap(uint256 newCap) external onlyRole(GOV_ROLE) {
        dailyInstantCapPerMember = newCap;
        emit DailyCapUpdated(newCap);
    }

    function setTargetBuffer(uint256 newTarget) external onlyRole(GOV_ROLE) {
        targetBuffer = newTarget;
        emit BufferTargetUpdated(newTarget);
    }

    function emergencyWithdraw(uint256 amount, address to) external onlyRole(GOV_ROLE) nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountZero();
        uint256 bal = bufferBalance();
        if (bal < amount) revert InsufficientBuffer();

        usdc.safeTransfer(to, amount);
        emit EmergencyWithdraw(to, amount);
        emit Synced(bufferBalance());
    }

    function sync() external onlyRole(GOV_ROLE) {
        emit Synced(bufferBalance());
    }

    function getBufferStatus() external view returns (
        uint256 current,
        uint256 target,
        uint256 utilizationBps,
        bool healthy
    ) {
        current = bufferBalance();
        target = targetBuffer;
        utilizationBps = target > 0 ? (current * 10000) / target : 0;
        healthy = utilizationBps >= 8000;
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
