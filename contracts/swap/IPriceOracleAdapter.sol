// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPriceOracleAdapter
 * @notice Interface for price oracle adapter
 * @dev Thin interface for connecting to pricing service
 */
interface IPriceOracleAdapter {
    /**
     * @notice Get the risk oracle address
     * @return riskOracle Address of the risk oracle
     */
    function riskOracle() external view returns (address riskOracle);
}
