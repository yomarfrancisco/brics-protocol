// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MalRedemptionClaim
 * @dev Malicious RedemptionClaim contract for testing reentrancy protection
 * Attempts to reenter the IssuanceController during settleAndBurn
 */
contract MalRedemptionClaim is ERC1155, AccessControl {
    address public targetContract;
    bytes public reentrantCall;
    bool public shouldReenter;
    uint256 public reentrantCount;

    mapping(uint256 => ClaimInfo) public claimInfo;

    struct ClaimInfo {
        address owner;
        uint256 amountTokens;
        bool settled;
    }

    constructor() ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setReentrantTarget(address _target, bytes calldata _call) external {
        targetContract = _target;
        reentrantCall = _call;
    }

    function setShouldReenter(bool _should) external {
        shouldReenter = _should;
    }

    function mintClaim(address to, uint256 strikeTs, uint256 amount) external returns (uint256) {
        uint256 claimId = uint256(keccak256(abi.encodePacked(to, strikeTs, amount, block.timestamp)));
        claimInfo[claimId] = ClaimInfo(to, amount, false);
        _mint(to, claimId, amount, "");
        return claimId;
    }

    function settleAndBurn(uint256 claimId, address holder) external {
        ClaimInfo storage info = claimInfo[claimId];
        require(info.owner == holder && !info.settled, "Invalid claim");
        
        // Mark as settled BEFORE external call (CEI pattern)
        info.settled = true;
        
        // Attempt reentrant call if enabled
        if (shouldReenter && targetContract != address(0) && reentrantCount < 3) {
            reentrantCount++;
            (bool callSuccess,) = targetContract.call(reentrantCall);
            // Don't revert on reentrant call failure
        }
        
        // Burn the tokens
        _burn(holder, claimId, info.amountTokens);
    }

    function getClaimInfo(uint256 claimId) external view returns (address owner, uint256 amountTokens, bool settled) {
        ClaimInfo storage info = claimInfo[claimId];
        return (info.owner, info.amountTokens, info.settled);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
