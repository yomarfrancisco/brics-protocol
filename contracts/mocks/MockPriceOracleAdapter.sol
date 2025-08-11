// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../swap/IPriceOracleAdapter.sol";

/**
 * @title MockPriceOracleAdapter
 * @notice Mock price oracle adapter for testing
 * @dev Simple mock that returns a fixed risk oracle address
 */
contract MockPriceOracleAdapter is IPriceOracleAdapter {
    address public immutable riskOracle;

    /**
     * @notice Constructor
     * @param _riskOracle Risk oracle address
     */
    constructor(address _riskOracle) {
        riskOracle = _riskOracle;
    }
}
