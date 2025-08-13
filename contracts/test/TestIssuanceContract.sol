// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IssuanceGuard} from "../libraries/IssuanceGuard.sol";
import {ISovereignCapacityOracle} from "../oracle/ISovereignCapacityOracle.sol";

/**
 * @title TestIssuanceContract
 * @notice Test contract that uses IssuanceGuard for testing
 */
contract TestIssuanceContract {
    using IssuanceGuard for *;
    
    ISovereignCapacityOracle public oracle;
    address public config;
    
    constructor(ISovereignCapacityOracle _oracle, address _config) {
        oracle = _oracle;
        config = _config;
    }
    
    function testIssuance(uint256 totalOutstanding, uint256 requested, uint256 maxAge) external view {
        IssuanceGuard.checkIssuanceCap(oracle, config, totalOutstanding, requested, maxAge);
    }
}
