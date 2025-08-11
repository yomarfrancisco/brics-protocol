// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAdaptiveTranching
 * @notice Interface for Adaptive Tranching v0.1 scaffold
 * @dev No economic logic changes in v0.1 - only interfaces and events
 */
interface IAdaptiveTranching {
    /**
     * @notice Risk signal structure for adaptive tranching
     * @param sovereignUsageBps Sovereign guarantee utilization (0-10000 bps)
     * @param portfolioDefaultsBps Portfolio default rate (0-10000 bps)
     * @param corrPpm Correlation coefficient (0-1000000 ppm)
     * @param asOf Timestamp of signal
     */
    struct RiskSignal {
        uint64 sovereignUsageBps;
        uint64 portfolioDefaultsBps;
        uint32 corrPpm;
        uint48 asOf;
    }

    /**
     * @notice Operating modes for adaptive tranching
     */
    enum TranchingMode {
        DISABLED,   // 0: No adaptive behavior
        DRY_RUN,    // 1: Log signals, no enforcement
        ENFORCED    // 2: Full adaptive behavior (future)
    }

    /**
     * @notice Emitted when a risk signal is submitted
     * @param signal The risk signal data
     * @param submitter Address that submitted the signal
     */
    event RiskSignalSubmitted(RiskSignal signal, address indexed submitter);

    /**
     * @notice Emitted when tranching mode is changed
     * @param mode New tranching mode
     * @param governor Address that changed the mode
     */
    event TranchingModeChanged(uint8 mode, address indexed governor);

    /**
     * @notice Emitted when thresholds are updated
     * @param sovereignUsageBps New sovereign usage threshold
     * @param defaultsBps New defaults threshold
     * @param corrPpm New correlation threshold
     */
    event ThresholdsUpdated(uint64 sovereignUsageBps, uint64 defaultsBps, uint32 corrPpm);

    /**
     * @notice Get current tranching mode
     * @return Current mode (0=DISABLED, 1=DRY_RUN, 2=ENFORCED)
     */
    function getTranchingMode() external view returns (uint8);

    /**
     * @notice Get current thresholds
     * @return sovereignUsageBps Sovereign usage threshold
     * @return defaultsBps Defaults threshold
     * @return corrPpm Correlation threshold
     */
    function getTranchingThresholds() external view returns (
        uint64 sovereignUsageBps,
        uint64 defaultsBps,
        uint32 corrPpm
    );

    /**
     * @notice Submit a risk signal (restricted access)
     * @param signal The risk signal to submit
     * @dev Only callable by authorized oracles
     */
    function submitSignal(RiskSignal calldata signal) external;
}
