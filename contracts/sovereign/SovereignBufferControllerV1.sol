// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "./ISovereignBuffer.sol";

/**
 * @title SovereignBufferControllerV1
 * @dev Controller for sovereign buffer bookkeeping and integration
 * @notice Manages buffer top-ups, drawdowns, and NAV flow integration
 * @author BRICS Protocol
 */
contract SovereignBufferControllerV1 is AccessControl {
    // ============ Storage ============
    
    /// @notice Sovereign buffer adapter address
    address public sovereignBuffer;
    
    /// @notice Current buffer NAV (in base units)
    uint256 public bufferNAV;
    
    /// @notice Total top-ups recorded
    uint256 public totalTopUps;
    
    /// @notice Total drawdowns recorded
    uint256 public totalDrawdowns;
    
    /// @notice Utilization threshold for triggering top-up requests (basis points)
    uint16 public utilizationThresholdBps;
    
    /// @notice Daily drawdown limit (in base units)
    uint256 public dailyDrawdownLimit;
    
    /// @notice Last drawdown timestamp for daily limit tracking
    uint256 public lastDrawdownTimestamp;
    
    /// @notice Daily drawdown amount used
    uint256 public dailyDrawdownUsed;
    
    /// @notice Buffer target in basis points (default 300 = 3%)
    uint16 public bufferTargetBps;
    
    /// @notice Buffer epsilon in basis points to prevent oscillation (default 1 = 0.01%)
    uint16 public constant BUFFER_EPSILON_BPS = 1;
    
    // ============ Roles ============
    
    bytes32 public constant BUFFER_MANAGER_ROLE = keccak256("BUFFER_MANAGER");
    bytes32 public constant NAV_UPDATER_ROLE = keccak256("NAV_UPDATER");
    
    // ============ Events ============
    
    event BufferSet(address indexed buffer);
    event TopUpRecorded(uint256 amount, uint256 newBufferNAV);
    event DrawdownRecorded(uint256 amount, uint256 newBufferNAV);
    event UtilizationThresholdSet(uint16 bps);
    event DailyLimitSet(uint256 limit);
    event BufferNAVUpdated(uint256 newNAV);
    event BufferTargetSet(uint256 targetBps);
    event BufferTopUpSuppressed(uint256 target, uint256 bufferNAV, uint256 epsilon);
    
    // ============ Errors ============
    
    error ZeroAddress();
    error NotAuthorized();
    error InvalidAmount();
    error InvalidUtilization();
    error DailyLimitExceeded();
    error InsufficientBuffer();
    error BufferNotSet();
    
    // ============ Constructor ============
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BUFFER_MANAGER_ROLE, msg.sender);
        _grantRole(NAV_UPDATER_ROLE, msg.sender);
        
        utilizationThresholdBps = 8000; // 80% default
        dailyDrawdownLimit = 1000e18; // 1000 tokens default
        bufferTargetBps = 300; // 3% default
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Set sovereign buffer adapter (admin only)
     * @param _buffer Buffer adapter address
     */
    function setSovereignBuffer(address _buffer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_buffer == address(0)) revert ZeroAddress();
        
        sovereignBuffer = _buffer;
        emit BufferSet(_buffer);
    }
    
    /**
     * @notice Record a top-up to the buffer (buffer manager only)
     * @param amount Amount topped up
     */
    function recordTopUp(uint256 amount) external onlyRole(BUFFER_MANAGER_ROLE) {
        if (amount == 0) revert InvalidAmount();
        
        bufferNAV += amount;
        totalTopUps += amount;
        
        emit TopUpRecorded(amount, bufferNAV);
    }
    
    /**
     * @notice Record a drawdown from the buffer (buffer manager only)
     * @param amount Amount drawn down
     */
    function recordDrawdown(uint256 amount) external onlyRole(BUFFER_MANAGER_ROLE) {
        if (amount == 0) revert InvalidAmount();
        if (amount > bufferNAV) revert InsufficientBuffer();
        
        // Check daily limit
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastDrawdownTimestamp) {
            dailyDrawdownUsed = 0;
            lastDrawdownTimestamp = currentDay;
        }
        
        if (dailyDrawdownUsed + amount > dailyDrawdownLimit) {
            revert DailyLimitExceeded();
        }
        
        bufferNAV -= amount;
        totalDrawdowns += amount;
        dailyDrawdownUsed += amount;
        
        emit DrawdownRecorded(amount, bufferNAV);
    }

    /**
     * @notice Draw stablecoins to a recipient (redemption queue only)
     * @param to Recipient address
     * @param amount Amount to draw
     */
    function drawdown(address to, uint256 amount) external onlyRole(BUFFER_MANAGER_ROLE) {
        if (amount == 0) revert InvalidAmount();
        if (to == address(0)) revert ZeroAddress();
        if (amount > bufferNAV) revert InsufficientBuffer();
        
        // Check daily limit
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastDrawdownTimestamp) {
            dailyDrawdownUsed = 0;
            lastDrawdownTimestamp = currentDay;
        }
        
        if (dailyDrawdownUsed + amount > dailyDrawdownLimit) {
            revert DailyLimitExceeded();
        }
        
        bufferNAV -= amount;
        totalDrawdowns += amount;
        dailyDrawdownUsed += amount;
        
        // In a real implementation, this would transfer stablecoins to the recipient
        // For now, we just record the drawdown
        emit DrawdownRecorded(amount, bufferNAV);
    }
    
    /**
     * @notice Update buffer NAV (NAV updater only)
     * @param newNAV New buffer NAV
     */
    function updateBufferNAV(uint256 newNAV) external onlyRole(NAV_UPDATER_ROLE) {
        bufferNAV = newNAV;
        emit BufferNAVUpdated(newNAV);
    }
    
    /**
     * @notice Set utilization threshold (admin only)
     * @param bps Threshold in basis points
     */
    function setUtilizationThreshold(uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bps > 10000) revert InvalidUtilization();
        
        utilizationThresholdBps = bps;
        emit UtilizationThresholdSet(bps);
    }
    
    /**
     * @notice Set daily drawdown limit (admin only)
     * @param limit Daily limit in base units
     */
    function setDailyDrawdownLimit(uint256 limit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dailyDrawdownLimit = limit;
        emit DailyLimitSet(limit);
    }
    
    /**
     * @notice Set buffer target in basis points (admin only)
     * @param targetBps Target in basis points
     */
    function setBufferTargetBps(uint16 targetBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (targetBps > 10000) revert InvalidUtilization();
        
        bufferTargetBps = targetBps;
        emit BufferTargetSet(targetBps);
    }
    
    /**
     * @notice Request top-up from sovereign buffer if utilization is high
     * @param currentUtilizationBps Current utilization in basis points
     */
    function checkAndRequestTopUp(uint16 currentUtilizationBps) external onlyRole(BUFFER_MANAGER_ROLE) {
        if (sovereignBuffer == address(0)) revert BufferNotSet();
        if (currentUtilizationBps > 10000) revert InvalidUtilization();
        
        if (currentUtilizationBps >= utilizationThresholdBps) {
            // Request top-up - amount could be configurable or calculated
            uint256 topUpAmount = 1000e18; // Default 1000 tokens
            ISovereignBuffer(sovereignBuffer).requestTopUp(topUpAmount);
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current buffer utilization in basis points
     * @param totalAssets Total assets in the system
     * @return Utilization in basis points
     */
    function utilizationBps(uint256 totalAssets) external view returns (uint16) {
        if (totalAssets == 0) return 0;
        if (bufferNAV == 0) return 10000; // 100% if no buffer
        
        // Utilization = (totalAssets - bufferNAV) / totalAssets
        uint256 nonBufferAssets = totalAssets > bufferNAV ? totalAssets - bufferNAV : 0;
        return uint16((nonBufferAssets * 10000) / totalAssets);
    }
    
    /**
     * @notice Get remaining daily drawdown capacity
     * @return Remaining capacity in base units
     */
    function remainingDailyDrawdown() external view returns (uint256) {
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastDrawdownTimestamp) {
            return dailyDrawdownLimit;
        }
        return dailyDrawdownLimit > dailyDrawdownUsed ? dailyDrawdownLimit - dailyDrawdownUsed : 0;
    }
    
    /**
     * @notice Check if buffer is available for drawdown
     * @param amount Amount to check
     * @return True if available
     */
    function canDrawdown(uint256 amount) external view returns (bool) {
        if (amount == 0 || amount > bufferNAV) return false;
        
        uint256 currentDay = block.timestamp / 1 days;
        uint256 usedToday = currentDay > lastDrawdownTimestamp ? 0 : dailyDrawdownUsed;
        
        return usedToday + amount <= dailyDrawdownLimit;
    }
    
    /**
     * @notice Get buffer shortfall amount based on target with epsilon to prevent oscillation
     * @param totalAssets Total assets in the system
     * @return Shortfall amount in base units
     */
    function bufferShortfall(uint256 totalAssets) external view returns (uint256) {
        if (totalAssets == 0) return 0;
        
        // Calculate target based on token NAV (non-buffer assets)
        uint256 tokenNAV = totalAssets > bufferNAV ? totalAssets - bufferNAV : totalAssets;
        uint256 targetAmount = (tokenNAV * bufferTargetBps) / 10000;
        
        if (bufferNAV >= targetAmount) return 0;
        
        uint256 shortfall = targetAmount - bufferNAV;
        
        // Apply epsilon to prevent oscillation for tiny shortfalls
        uint256 epsilon = (targetAmount * BUFFER_EPSILON_BPS) / 10000;
        if (shortfall <= epsilon) {
            return 0;
        }
        
        return shortfall;
    }
    
    /**
     * @notice Check if buffer top-up was suppressed by epsilon and emit event if so
     * @param totalAssets Total assets in the system
     * @return True if suppression occurred
     */
    function checkAndEmitSuppression(uint256 totalAssets) external returns (bool) {
        if (totalAssets == 0) return false;
        
        // Calculate target based on token NAV (non-buffer assets)
        uint256 tokenNAV = totalAssets > bufferNAV ? totalAssets - bufferNAV : totalAssets;
        uint256 targetAmount = (tokenNAV * bufferTargetBps) / 10000;
        
        if (bufferNAV >= targetAmount) return false;
        
        uint256 shortfall = targetAmount - bufferNAV;
        uint256 epsilon = (targetAmount * BUFFER_EPSILON_BPS) / 10000;
        
        if (shortfall > 0 && shortfall <= epsilon) {
            emit BufferTopUpSuppressed(targetAmount, bufferNAV, epsilon);
            return true;
        }
        
        return false;
    }
}
