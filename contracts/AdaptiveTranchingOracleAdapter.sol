// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IAdaptiveTranching.sol";
import "./libraries/RiskSignalLib.sol";

/**
 * @title AdaptiveTranchingOracleAdapter
 * @notice Oracle adapter stub for Adaptive Tranching v0.1
 * @dev Role-gated signal submission with caching, no enforcement logic
 */
contract AdaptiveTranchingOracleAdapter is AccessControl, IAdaptiveTranching {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant GOV_ROLE = keccak256("GOV_ROLE");

    // Target contract for signal submission
    address public immutable targetContract;

    // Risk oracle address for signature verification
    address public riskOracle;

    // Last submitted signal (read-only cache)
    RiskSignal public lastSignal;

    // Events (re-emitted from target)
    event SignalCached(RiskSignal signal, address indexed submitter, uint256 timestamp);

    /**
     * @notice Constructor
     * @param gov Governance address
     * @param target Target contract for signal submission
     * @param oracle Risk oracle address for signature verification
     */
    constructor(address gov, address target, address oracle) {
        require(gov != address(0), "gov cannot be zero address");
        require(target != address(0), "target cannot be zero address");
        require(oracle != address(0), "oracle cannot be zero address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
        _grantRole(ORACLE_ROLE, gov); // Gov can also submit signals
        
        targetContract = target;
        riskOracle = oracle;
    }

    /**
     * @notice Submit a risk signal (role-gated)
     * @param signal The risk signal to submit
     * @dev Only callable by ORACLE_ROLE or GOV_ROLE
     */
    function submitSignal(RiskSignal calldata signal) external override {
        require(hasRole(ORACLE_ROLE, msg.sender) || hasRole(GOV_ROLE, msg.sender), "unauthorized");
        
        // Validate signal
        require(signal.sovereignUsageBps <= 10000, "sovereign usage > 100%");
        require(signal.portfolioDefaultsBps <= 10000, "defaults > 100%");
        require(signal.corrPpm <= 1000000, "correlation > 100%");
        require(signal.asOf <= block.timestamp, "future timestamp");
        
        // Cache the signal
        lastSignal = signal;
        
        // Emit local event
        emit SignalCached(signal, msg.sender, block.timestamp);
        
        // Forward to target contract (if it implements the interface)
        try IAdaptiveTranching(targetContract).submitSignal(signal) {
            // Success - target contract handled the signal
        } catch {
            // Target contract doesn't implement or failed - this is expected in v0.1
            // No economic impact, just logging
        }
    }

    /**
     * @notice Get current tranching mode from target
     * @return Current mode (0=DISABLED, 1=DRY_RUN, 2=ENFORCED)
     */
    function getTranchingMode() external view override returns (uint8) {
        try IAdaptiveTranching(targetContract).getTranchingMode() returns (uint8 mode) {
            return mode;
        } catch {
            return 0; // Default to DISABLED if target doesn't implement
        }
    }

    /**
     * @notice Get current thresholds from target
     * @return sovereignUsageBps Sovereign usage threshold
     * @return defaultsBps Defaults threshold
     * @return corrPpm Correlation threshold
     */
    function getTranchingThresholds() external view override returns (
        uint64 sovereignUsageBps,
        uint64 defaultsBps,
        uint32 corrPpm
    ) {
        try IAdaptiveTranching(targetContract).getTranchingThresholds() returns (
            uint64 _sovereignUsageBps,
            uint64 _defaultsBps,
            uint32 _corrPpm
        ) {
            return (_sovereignUsageBps, _defaultsBps, _corrPpm);
        } catch {
            // Default thresholds if target doesn't implement
            return (2000, 1000, 650000);
        }
    }

    /**
     * @notice Grant oracle role to address
     * @param oracle Oracle address
     * @dev Only callable by DEFAULT_ADMIN_ROLE
     */
    function grantOracleRole(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(oracle != address(0), "oracle cannot be zero address");
        _grantRole(ORACLE_ROLE, oracle);
    }

    /**
     * @notice Revoke oracle role from address
     * @param oracle Oracle address
     * @dev Only callable by DEFAULT_ADMIN_ROLE
     */
    function revokeOracleRole(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ORACLE_ROLE, oracle);
    }

    /**
     * @notice Check if address has oracle role
     * @param oracle Oracle address
     * @return True if address has oracle role
     */
    function hasOracleRole(address oracle) external view returns (bool) {
        return hasRole(ORACLE_ROLE, oracle);
    }

    /**
     * @notice Set risk oracle address (only admin)
     * @param oracle New risk oracle address
     * @dev Only callable by DEFAULT_ADMIN_ROLE
     */
    function setRiskOracle(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(oracle != address(0), "oracle cannot be zero address");
        riskOracle = oracle;
    }

    /**
     * @notice Submit a signed risk signal
     * @param payload The risk signal payload
     * @param signature ECDSA signature from risk oracle
     * @dev Verifies signature and forwards to target contract
     */
    function submitSignedRiskSignal(RiskSignalLib.Payload calldata payload, bytes calldata signature) external {
        // Verify signature
        address signer = RiskSignalLib.recoverSigner(payload, signature);
        require(signer == riskOracle, "bad-signer");

        // Validate payload
        require(payload.correlationBps <= 10000, "correlation > 100%");
        require(payload.spreadBps <= 20000, "spread > 200%");
        require(payload.asOf <= block.timestamp, "future timestamp");

        // Convert to RiskSignal format for compatibility
        RiskSignal memory signal = RiskSignal({
            sovereignUsageBps: 0, // Not used in signed signals
            portfolioDefaultsBps: 0, // Not used in signed signals
            corrPpm: uint32(payload.correlationBps) * 100, // Convert bps to ppm
            asOf: uint48(payload.asOf)
        });

        // Cache the signal
        lastSignal = signal;
        
        // Emit local event
        emit SignalCached(signal, msg.sender, block.timestamp);
        
        // Forward to target contract (if it implements the interface)
        try IAdaptiveTranching(targetContract).submitSignal(signal) {
            // Success - target contract handled the signal
        } catch {
            // Target contract doesn't implement or failed - this is expected in v0.1
            // No economic impact, just logging
        }
    }
}
