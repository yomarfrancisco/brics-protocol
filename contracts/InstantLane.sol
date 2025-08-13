// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAMM} from "./interfaces/IAMM.sol";
import {IPMM} from "./interfaces/IPMM.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IConfigRegistryLike {
    function getUint(bytes32 k) external view returns (uint256);
    function getBoundsForLevel(uint8 level) external view returns (uint256 minBps, uint256 maxBps);
    function getEconomics() external view returns (uint256 tradeFeeBps, uint256 pmmCurveK_bps, uint256 pmmTheta_bps, uint256 maxBoundBps);
}
interface INAVOracleLike {
    function latestNAVRay() external view returns (uint256); // 1e27 precision
}
interface IMemberRegistryLike {
    function isMember(address who) external view returns (bool);
}

/// @title InstantLane
/// @notice Member-gated, price-bounded, per-member daily-cap instant redemption via AMM
contract InstantLane is Pausable, AccessControl {
    error IL_NOT_MEMBER();
    error IL_CAP_EXCEEDED();
    error IL_BOUNDS();
    error IL_LEVEL();
    error IL_APPROVAL();
    error IL_TRANSFER_FAIL();
    
    // Roles
    bytes32 public constant GOV_ROLE = keccak256("GOV");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER");

    event InstantRedeem(address indexed member, uint256 tokensIn18, uint256 usdcQuoted, uint256 usdcOut, uint256 priceBps);

    IERC20 public immutable brics;     // 18 decimals
    IERC20 public immutable usdc;      // 6 decimals
    INAVOracleLike public immutable oracle;
    IMemberRegistryLike public immutable members;
    IAMM public immutable amm;
    IConfigRegistryLike public immutable cfg; // optional, can be address(0)
    IPMM public immutable pmm; // optional, can be address(0)

    // Config keys
    bytes32 private constant K_DAILY_CAP_USDC = keccak256("instant.dailyCap.usdc");      // default 50_000e6
    
    // Emergency level-aware bounds
    bytes32 private constant K_EMERGENCY_LEVEL = keccak256("emergency.level");           // default 0
    bytes32 private constant K_DISABLE_LEVEL = keccak256("instant.price.disable.at.level"); // default 3
    
    // Level-specific bounds (L0, L1, L2)
    bytes32 private constant K_PRICE_MIN_BPS_L0 = keccak256("instant.price.min.bps.L0"); // default 9_800
    bytes32 private constant K_PRICE_MAX_BPS_L0 = keccak256("instant.price.max.bps.L0"); // default 10_200
    bytes32 private constant K_PRICE_MIN_BPS_L1 = keccak256("instant.price.min.bps.L1"); // default 9_900
    bytes32 private constant K_PRICE_MAX_BPS_L1 = keccak256("instant.price.max.bps.L1"); // default 10_100
    bytes32 private constant K_PRICE_MIN_BPS_L2 = keccak256("instant.price.min.bps.L2"); // default 9_975
    bytes32 private constant K_PRICE_MAX_BPS_L2 = keccak256("instant.price.max.bps.L2"); // default 10_025

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
        IConfigRegistryLike _cfg,
        IPMM _pmm, // optional, can be address(0)
        address gov
    ) {
        brics = _brics;
        usdc = _usdc;
        oracle = _oracle;
        members = _members;
        amm = _amm;
        cfg = _cfg;
        pmm = _pmm;
        
        // Setup access control
        _grantRole(DEFAULT_ADMIN_ROLE, gov);
        _grantRole(GOV_ROLE, gov);
        _grantRole(PAUSER_ROLE, gov);
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

    function _emergencyLevel() internal view returns (uint256 lvl) {
        if (address(cfg) == address(0)) return 0;
        try cfg.getUint(K_EMERGENCY_LEVEL) returns (uint256 got) {
            lvl = got;
        } catch { 
            lvl = 0; 
        }
    }

    function _boundsForLevel(uint256 lvl) internal view returns (uint256 minBps, uint256 maxBps) {
        if (address(cfg) == address(0)) {
            // Fallback to hardcoded bounds if no config registry
            if (lvl == 0) {
                minBps = 9_800;
                maxBps = 10_200;
            } else if (lvl == 1) {
                minBps = 9_900;
                maxBps = 10_100;
            } else {
                // lvl >= 2 maps to L2 bounds; disabling handled separately
                minBps = 9_975;
                maxBps = 10_025;
            }
        } else {
            // Use ConfigRegistry's centralized bounds logic
            try cfg.getBoundsForLevel(uint8(lvl)) returns (uint256 min, uint256 max) {
                minBps = min;
                maxBps = max;
            } catch {
                // Fallback to hardcoded bounds if registry call fails
                if (lvl == 0) {
                    minBps = 9_800;
                    maxBps = 10_200;
                } else if (lvl == 1) {
                    minBps = 9_900;
                    maxBps = 10_100;
                } else {
                    minBps = 9_975;
                    maxBps = 10_025;
                }
            }
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
    function instantRedeem(uint256 tokens18) external whenNotPaused returns (uint256 usdcOut) {
        return _instantRedeem(msg.sender, tokens18);
    }

    /// @notice Instant redeem for a specific member (called by gateway)
    function instantRedeemFor(address member, uint256 tokens18) external whenNotPaused returns (uint256 usdcOut) {
        return _instantRedeem(member, tokens18);
    }

    /// @notice Internal instant redeem function
    function _instantRedeem(address member, uint256 tokens18) internal returns (uint256 usdcOut) {
        if (!members.isMember(member)) revert IL_NOT_MEMBER();

        (bool ok, uint256 capUSDC, uint256 used, uint256 need) = canInstantRedeem(member, tokens18);
        if (!ok) revert IL_CAP_EXCEEDED();

        // Check emergency level and enforce disable if needed
        uint256 lvl = _emergencyLevel();
        uint256 disableAt = _getOrDefault(K_DISABLE_LEVEL, 3);
        if (lvl >= disableAt) revert IL_LEVEL();

        // Get bounds for current emergency level
        (uint256 minBps, uint256 maxBps) = _boundsForLevel(lvl);

        // Pull BRICS from member
        if (!brics.transferFrom(member, address(this), tokens18)) revert IL_APPROVAL();

        // Convert tokens to USDC notionally (quote), then route to AMM/PMM
        uint256 usdcIn = need;
        uint256 p;

        // Choose routing: PMM if available, otherwise AMM
        if (address(pmm) != address(0)) {
            // PMM route
            p = pmm.quoteBps();
            if (p < minBps || p > maxBps) revert IL_BOUNDS();

            // Approve PMM to pull USDC
            (bool okApprove) = usdc.approve(address(pmm), usdcIn);
            require(okApprove, "IL/APPROVE_USDC_PMM");

            usdcOut = pmm.swapAtBps(usdcIn, p, member);
        } else {
            // AMM route
            p = IAMM(amm).priceBps();
            if (p < minBps || p > maxBps) revert IL_BOUNDS();

            // Approve AMM to pull USDC
            (bool okApprove) = usdc.approve(address(amm), usdcIn);
            require(okApprove, "IL/APPROVE_USDC");

            usdcOut = IAMM(amm).swap(usdcIn, member);
        }

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

    /// @notice Pre-trade check: reports if a candidate price is within current bounds for the given emergency level
    /// @param priceBps Price in basis points (e.g., 10000 = 100%)
    /// @param emergencyLevel Emergency level to check bounds for
    /// @return ok Whether the price is within bounds
    /// @return minBps Minimum allowed price in basis points
    /// @return maxBps Maximum allowed price in basis points
    function preTradeCheck(uint256 priceBps, uint8 emergencyLevel) external view returns (bool ok, uint256 minBps, uint256 maxBps) {
        (uint256 min, uint256 max) = _boundsForLevel(emergencyLevel);
        bool within = priceBps >= min && priceBps <= max;
        return (within, min, max);
    }
    
    // Pause controls
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
