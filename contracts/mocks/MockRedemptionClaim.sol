// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockRedemptionClaim
 * @notice Mock redemption claim for testing
 */
contract MockRedemptionClaim {
    mapping(uint256 => bool) public claims;
    uint256 public nextClaimId = 0;

    function mint(address to, uint256 amount) external returns (uint256 claimId) {
        claimId = nextClaimId++;
        claims[claimId] = true;
        return claimId;
    }

    function burn(uint256 claimId) external {
        require(claims[claimId], "Claim not found");
        delete claims[claimId];
    }
}
