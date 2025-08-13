// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RedemptionQueue
/// @notice Maintains queued redemption claims and enforces a strict lifecycle:
///         Queued -> Struck (NAV set) -> Settled (after payout)
/// @dev    No USDC transfers happen in this contract; the Gateway performs payouts
///         and then marks the claim as Settled here.

interface IAccessControllerLike {
    function hasRole(bytes32 role, address account) external view returns (bool);
}

interface IConfigRegistryLike {
    function getUint(bytes32 key) external view returns (uint256);
    function redemptionPriorityEnabled() external view returns (bool);
}

interface IRedemptionQueueViewLike {
    function calculatePriorityScore(
        address account,
        uint256 amount,
        uint64 asOf,
        uint16 telemetryFlags
    ) external view returns (uint256 priorityScore, uint16 reasonBits);
}

contract RedemptionQueue {
    // --- Roles/Config (optional hooks; no revert if unset) ---
    IAccessControllerLike public access;
    IConfigRegistryLike  public config;
    IRedemptionQueueViewLike public queueView;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    constructor(IAccessControllerLike _access, IConfigRegistryLike _config, IRedemptionQueueViewLike _queueView) {
        access = _access;
        config = _config;
        queueView = _queueView;
    }

    // --- Claim lifecycle ---
    enum ClaimStatus { Queued, Struck, Settled }

    struct Claim {
        uint256 tokens;        // BRICS token amount requested for redemption (18d)
        uint256 usdcOwed;      // Fixed at strike (6d)
        ClaimStatus status;    // lifecycle status
        uint64  struckAt;      // timestamp when struck (used for T+5)
        address owner;         // member who owns the claim
        uint8   lane;          // 0=Instant, 1=Primary (for analytics)
        // Priority integration fields (additive)
        uint256 priorityScore; // Priority score when enqueued (0 if not calculated)
        uint16  reasonBits;    // Reason bits for priority calculation
        uint64  enqueuedAt;    // Timestamp when enqueued (for tie-breaking)
    }

    event ClaimQueued(uint256 indexed claimId, address indexed owner, uint256 tokens, uint8 lane);
    event ClaimStruck(uint256 indexed claimId, uint256 usdcOwed, uint64 struckAt);
    event ClaimSettled(uint256 indexed claimId, uint256 usdcPaid, uint64 settledAt);

    mapping(uint256 => Claim) public claims;
    uint256 public nextClaimId;

    modifier onlyAdmin() {
        if (address(access) != address(0)) {
            require(access.hasRole(ADMIN_ROLE, msg.sender), "RQ/NOT_ADMIN");
        }
        _;
    }

    /// @notice Enqueue a primary-lane redemption claim
    /// @param member owner of claim
    /// @param amountTokens BRICS amount (18 decimals)
    /// @param lane redemption lane (0 instant, 1 primary). Only lane=1 should enqueue.
    function enqueue(address member, uint256 amountTokens, uint8 lane) external returns (uint256 claimId) {
        require(member != address(0), "RQ/BAD_MEMBER");
        require(amountTokens > 0, "RQ/AMOUNT_ZERO");
        // we allow any caller (gateway) to enqueue on user's behalf

        uint64 enqueuedAt = uint64(block.timestamp);
        uint256 priorityScore = 0;
        uint16 reasonBits = 0;

        // Calculate priority score if enabled
        if (address(config) != address(0) && config.redemptionPriorityEnabled()) {
            if (address(queueView) != address(0)) {
                (priorityScore, reasonBits) = queueView.calculatePriorityScore(
                    member,
                    amountTokens,
                    enqueuedAt,
                    0 // telemetryFlags
                );
            }
        }

        claimId = nextClaimId++;
        claims[claimId] = Claim({
            tokens: amountTokens,
            usdcOwed: 0,
            status: ClaimStatus.Queued,
            struckAt: 0,
            owner: member,
            lane: lane,
            priorityScore: priorityScore,
            reasonBits: reasonBits,
            enqueuedAt: enqueuedAt
        });
        emit ClaimQueued(claimId, member, amountTokens, lane);
    }

    /// @notice Set NAV for a batch of queued claims and move them to Struck
    /// @param claimIds array of queued claim IDs
    /// @param navRay   NAV per token in 27-decimal RAY (1e27)
    /// @dev    usdcOwed = tokens(1e18) * navRay(1e27) / 1e27 / 1e12 => 6 decimals
    function processStrike(uint256[] calldata claimIds, uint256 navRay) external onlyAdmin {
        require(navRay > 0, "RQ/BAD_NAV");
        uint64 ts = uint64(block.timestamp);
        for (uint256 i = 0; i < claimIds.length; i++) {
            uint256 id = claimIds[i];
            Claim storage c = claims[id];
            require(c.status == ClaimStatus.Queued, "RQ/NOT_QUEUED");
            // tokens(1e18) * navRay(1e27) / 1e27 = value in 1e18
            // convert 1e18 -> 1e6 (USDC) by / 1e12
            uint256 usdc6 = c.tokens / 1e12; // only valid if navRay == 1e27; apply navRay anyway:
            // Full formula avoiding rounding bias:
            usdc6 = (c.tokens * navRay) / 1e27 / 1e12;
            c.usdcOwed = usdc6;
            c.status   = ClaimStatus.Struck;
            c.struckAt = ts;
            emit ClaimStruck(id, usdc6, ts);
        }
    }

    /// @notice Mark claim as Settled after payout (called by Gateway)
    /// @param claimId claim to mark
    /// @param usdcPaid amount actually paid (should equal usdcOwed unless pro‑rata applied off‑chain)
    function markSettled(uint256 claimId, uint256 usdcPaid) external onlyAdmin {
        Claim storage c = claims[claimId];
        require(c.status == ClaimStatus.Struck, "RQ/NOT_STRUCK");
        c.status = ClaimStatus.Settled;
        emit ClaimSettled(claimId, usdcPaid, uint64(block.timestamp));
        delete claims[claimId];
    }

    /// -----------------------------------------------------------------------
    /// View helpers
    /// -----------------------------------------------------------------------
    function getClaim(uint256 claimId)
        external
        view
        returns (
            uint256 tokens,
            uint256 usdcOwed,
            ClaimStatus status,
            uint64 struckAt,
            address owner,
            uint8 lane
        )
    {
        Claim storage c = claims[claimId];
        return (c.tokens, c.usdcOwed, c.status, c.struckAt, c.owner, c.lane);
    }

    /// @notice Get claim metadata including priority information
    /// @param claimId claim to query
    /// @return priorityScore priority score when enqueued
    /// @return reasonBits reason bits for priority calculation
    /// @return enqueuedAt timestamp when enqueued
    function viewClaimMeta(uint256 claimId)
        external
        view
        returns (
            uint256 priorityScore,
            uint16 reasonBits,
            uint64 enqueuedAt
        )
    {
        Claim storage c = claims[claimId];
        return (c.priorityScore, c.reasonBits, c.enqueuedAt);
    }

    /// @notice Get next claim candidate for processing (priority-aware when enabled)
    /// @return claimId candidate claim ID
    /// @return priorityScore priority score of candidate
    /// @return reasonBits reason bits of candidate
    function viewNextClaim()
        external
        view
        returns (
            uint256 claimId,
            uint256 priorityScore,
            uint16 reasonBits
        )
    {
        bool priorityEnabled = address(config) != address(0) && config.redemptionPriorityEnabled();
        
        if (!priorityEnabled) {
            // FIFO mode: return first queued claim
            for (uint256 i = 0; i < nextClaimId; i++) {
                Claim storage c = claims[i];
                if (c.status == ClaimStatus.Queued) {
                    return (i, 0, 0);
                }
            }
        } else {
            // Priority mode: find highest priority queued claim
            uint256 bestClaimId = 0;
            uint256 bestScore = 0;
            uint16 bestReasons = 0;
            bool found = false;
            
            for (uint256 i = 0; i < nextClaimId; i++) {
                Claim storage c = claims[i];
                if (c.status == ClaimStatus.Queued) {
                    if (!found || c.priorityScore > bestScore || 
                        (c.priorityScore == bestScore && c.enqueuedAt < claims[bestClaimId].enqueuedAt)) {
                        bestClaimId = i;
                        bestScore = c.priorityScore;
                        bestReasons = c.reasonBits;
                        found = true;
                    }
                }
            }
            
            if (found) {
                return (bestClaimId, bestScore, bestReasons);
            }
        }
        
        // No queued claims found
        return (0, 0, 0);
    }
}
