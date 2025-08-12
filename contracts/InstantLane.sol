// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAMM} from "./interfaces/IAMM.sol";

interface IConfigRegistryLike {
    function getUint(bytes32 k) external view returns (uint256);
}
interface INAVOracleLike {
    function latestNAVRay() external view returns (uint256); // 1e27 precision
}
interface IMemberRegistryLike {
    function isMember(address who) external view returns (bool);
}

/// @title InstantLane
/// @notice Member-gated, price-bounded, per-member daily-cap instant redemption via AMM
contract InstantLane {
    error IL_NOT_MEMBER();
    error IL_CAP_EXCEEDED();
    error IL_BOUNDS();
    error IL_APPROVAL();
    error IL_TRANSFER_FAIL();

    event InstantRedeem(address indexed member, uint256 tokensIn18, uint256 usdcQuoted, uint256 usdcOut, uint256 priceBps);

    IERC20 public immutable brics;     // 18 decimals
    IERC20 public immutable usdc;      // 6 decimals
    INAVOracleLike public immutable oracle;
    IMemberRegistryLike public immutable members;
    IAMM public immutable amm;
    IConfigRegistryLike public immutable cfg; // optional, can be address(0)

    // Config keys
    bytes32 private constant K_DAILY_CAP_USDC = keccak256("instant.dailyCap.usdc");      // default 50_000e6
    bytes32 private constant K_PRICE_MIN_BPS  = keccak256("instant.price.min.bps");      // default 9_800
    bytes32 private constant K_PRICE_MAX_BPS  = keccak256("instant.price.max.bps");      // default 10_200

    struct Daily {
        uint64 day;        // UTC day number
        uint192 usedUSDC;  // used in 6 decimals
    }
    mapping(address => Daily) public dailyUsed;

    uint256 private constant RAY = 1e27;

    constructor(
        IERC20 _brics,
        IERC20 _usdc,
        INAVOracleLike _oracle,
        IMemberRegistryLike _members,
        IAMM _amm,
        IConfigRegistryLike _cfg
    ) {
        brics = _brics;
        usdc = _usdc;
        oracle = _oracle;
        members = _members;
        amm = _amm;
        cfg = _cfg;
    }

    function _utcDay() internal view returns (uint64) {
        return uint64(block.timestamp / 1 days);
    }

    function _getOrDefault(bytes32 k, uint256 defVal) internal view returns (uint256 v) {
        if (address(cfg) == address(0)) return defVal;
        // defensive try/catch in case registry reverts
        try cfg.getUint(k) returns (uint256 got) {
            v = got == 0 ? defVal : got;
        } catch {
            v = defVal;
        }
    }

    function quoteUSDCForTokens(uint256 tokens18) public view returns (uint256 usdc6) {
        // NAV in RAY (1e27). tokens are 1e18. USDC is 1e6.
        // USDC = tokens * NAV(1e27) / 1e27 * (1e6 / 1e18)  => tokens18 * navRay / 1e39
        uint256 navRay = oracle.latestNAVRay();
        // Multiply then divide to keep precision: (tokens18 * navRay) / 1e39
        // Avoid overflow: tokens18 up to ~1e36 workable; navRay 1e27 => 1e63 < 2^256 ~ 1.16e77
        usdc6 = (tokens18 * navRay) / 1e39;
    }

    function canInstantRedeem(address member, uint256 tokens18) public view returns (bool ok, uint256 capUSDC, uint256 usedUSDC, uint256 needUSDC) {
        if (!members.isMember(member)) return (false, 0, 0, 0);
        capUSDC = _getOrDefault(K_DAILY_CAP_USDC, 50_000 * 1e6);
        Daily memory d = dailyUsed[member];
        uint64 today = _utcDay();
        usedUSDC = (d.day == today) ? d.usedUSDC : 0;
        needUSDC = quoteUSDCForTokens(tokens18);
        ok = (usedUSDC + needUSDC) <= capUSDC;
    }

    /// @notice Instant redeem BRICS tokens for USDC via AMM, enforcing member gating, daily cap, and price bounds
    function instantRedeem(uint256 tokens18) external returns (uint256 usdcOut) {
        return _instantRedeem(msg.sender, tokens18);
    }

    /// @notice Instant redeem for a specific member (called by gateway)
    function instantRedeemFor(address member, uint256 tokens18) external returns (uint256 usdcOut) {
        return _instantRedeem(member, tokens18);
    }

    /// @notice Internal instant redeem function
    function _instantRedeem(address member, uint256 tokens18) internal returns (uint256 usdcOut) {
        if (!members.isMember(member)) revert IL_NOT_MEMBER();

        (bool ok, uint256 capUSDC, uint256 used, uint256 need) = canInstantRedeem(member, tokens18);
        if (!ok) revert IL_CAP_EXCEEDED();

        // Enforce AMM price bounds
        uint256 p = IAMM(amm).priceBps(); // e.g., 9950, 10000, 10050
        uint256 minBps = _getOrDefault(K_PRICE_MIN_BPS, 9_800);
        uint256 maxBps = _getOrDefault(K_PRICE_MAX_BPS, 10_200);
        if (p < minBps || p > maxBps) revert IL_BOUNDS();

        // Pull BRICS from member
        if (!brics.transferFrom(member, address(this), tokens18)) revert IL_APPROVAL();

        // Convert tokens to USDC notionally (quote), then route to AMM (USDC in == notionally required)
        uint256 usdcIn = need;

        // We need to fund AMM input from this contract: transfer USDC from member or use buffer.
        // For this minimal lane, we assume the lane contract already holds operational USDC "buffer".
        // So only perform the AMM call spending this contract's USDC (no extra transferFrom).
        // Approvals are not needed with simple ERC20 if AMM pulls; our mock AMM pulls via transferFrom,
        // so approve beforehand:
        (bool okApprove) = usdc.approve(address(amm), usdcIn);
        require(okApprove, "IL/APPROVE_USDC");

        // Execute swap and pay proceeds to the member
        usdcOut = IAMM(amm).swap(usdcIn, member);

        // Update daily used
        uint64 today = _utcDay();
        Daily memory d = dailyUsed[member];
        if (d.day != today) {
            d.day = today;
            d.usedUSDC = 0;
        }
        d.usedUSDC += uint192(need);
        dailyUsed[member] = d;

        emit InstantRedeem(member, tokens18, usdcIn, usdcOut, p);
    }
}
