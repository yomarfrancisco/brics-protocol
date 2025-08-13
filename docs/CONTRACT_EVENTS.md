# Contract Events

This document is auto-generated from contract ABIs.

| Contract | Event | Inputs | Indexed | Notes |
|----------|-------|--------|---------|-------|
| AdaptiveTranchingOracleAdapter | RiskSignalSubmitted | signal: tuple, submitter: address (indexed) | 1 | 1 indexed inputs for efficient filtering |
| AdaptiveTranchingOracleAdapter | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| AdaptiveTranchingOracleAdapter | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| AdaptiveTranchingOracleAdapter | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| AdaptiveTranchingOracleAdapter | SignalCached | signal: tuple, submitter: address (indexed), timestamp: uint256 | 1 | 1 indexed inputs for efficient filtering |
| AdaptiveTranchingOracleAdapter | ThresholdsUpdated | sovereignUsageBps: uint64, defaultsBps: uint64, corrPpm: uint32 | 0 |  |
| AdaptiveTranchingOracleAdapter | TranchingModeChanged | mode: uint8, governor: address (indexed) | 1 | 1 indexed inputs for efficient filtering |
| BRICSToken | Approval | owner: address (indexed), spender: address (indexed), value: uint256 | 2 | Token approval event; 2 indexed inputs for efficient filtering |
| BRICSToken | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| BRICSToken | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| BRICSToken | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| BRICSToken | Transfer | from: address (indexed), to: address (indexed), value: uint256 | 2 | Token transfer event; 2 indexed inputs for efficient filtering |
| ClaimRegistry | Acknowledged | claimId: uint256 (indexed), ts: uint256, refNo: string | 1 | 1 indexed inputs for efficient filtering |
| ClaimRegistry | ClaimTriggered | claimId: uint256 (indexed), reason: string, baseLoss: uint256, coveredLoss: uint256 | 1 | 1 indexed inputs for efficient filtering |
| ClaimRegistry | NoticeServed | claimId: uint256 (indexed), dossierHash: bytes32, jurisdiction: string, ts: uint256 | 1 | 1 indexed inputs for efficient filtering |
| ClaimRegistry | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| ClaimRegistry | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| ClaimRegistry | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| ClaimRegistry | ScheduledPayment | claimId: uint256 (indexed), ts: uint256, amount: uint256 | 1 | 1 indexed inputs for efficient filtering |
| ClaimRegistry | Settlement | claimId: uint256 (indexed), ts: uint256, amount: uint256, refNo: string | 1 | 1 indexed inputs for efficient filtering |
| ClaimRegistry | SovereignGuaranteeConfirmed | confirmed: bool, reason: string | 0 |  |
| ConfigRegistry | EmergencyLevelSet | level: uint8, reason: string | 0 | Emergency state change |
| ConfigRegistry | EmergencyParamsSet | level: uint8, params: tuple | 0 | Parameter update event; Emergency state change |
| ConfigRegistry | ParamSet | key: bytes32, value: uint256 | 0 | Parameter update event |
| ConfigRegistry | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| ConfigRegistry | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| ConfigRegistry | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| ConfigRegistry | SovereignAdded | code: bytes32 (indexed), utilCapBps: uint256, haircutBps: uint256, weightBps: uint256, enabled: bool | 1 | 1 indexed inputs for efficient filtering |
| ConfigRegistry | SovereignEnabled | code: bytes32 (indexed), enabled: bool | 1 | 1 indexed inputs for efficient filtering |
| ConfigRegistry | SovereignUpdated | code: bytes32 (indexed), utilCapBps: uint256, haircutBps: uint256, weightBps: uint256, enabled: bool | 1 | 1 indexed inputs for efficient filtering |
| InstantLane | InstantRedeem | member: address (indexed), tokensIn18: uint256, usdcQuoted: uint256, usdcOut: uint256, priceBps: uint256 | 1 | Redemption event; 1 indexed inputs for efficient filtering |
| InstantLane | Paused | account: address | 0 | Pause state change |
| InstantLane | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| InstantLane | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| InstantLane | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| InstantLane | Unpaused | account: address | 0 | Pause state change |
| IssuanceControllerV3 | DailyIssueCapSet | newCap: uint256 | 0 |  |
| IssuanceControllerV3 | DampingSlopeSet | newSlope: uint256 | 0 |  |
| IssuanceControllerV3 | DetachmentRatified | lo: uint16, hi: uint16 | 0 |  |
| IssuanceControllerV3 | DetachmentReverted | lo: uint16, hi: uint16 | 0 |  |
| IssuanceControllerV3 | InstantRedeemProcessed | user: address (indexed), amount: uint256, source: string | 1 | Redemption event; 1 indexed inputs for efficient filtering |
| IssuanceControllerV3 | Minted | user: address (indexed), usdcIn: uint256, tokensOut: uint256 | 1 | 1 indexed inputs for efficient filtering |
| IssuanceControllerV3 | MintNonceReset |  | 0 |  |
| IssuanceControllerV3 | MintNonceResetRequested | requester: address (indexed), executeAt: uint256 | 1 | 1 indexed inputs for efficient filtering |
| IssuanceControllerV3 | MintRequestSigned | signer: address (indexed), to: address (indexed), usdcAmt: uint256, nonce: uint256 | 2 | 2 indexed inputs for efficient filtering |
| IssuanceControllerV3 | NAVCarryoverCreated | fromWindowId: uint256 (indexed), claimId: uint256 (indexed), carryoverUSDC: uint256 | 2 | 2 indexed inputs for efficient filtering |
| IssuanceControllerV3 | NAVClaimsMinted | windowId: uint256 (indexed), count: uint256, totalTokensClaimed: uint256 | 1 | 1 indexed inputs for efficient filtering |
| IssuanceControllerV3 | NAVRequestCreated | windowId: uint256 (indexed), user: address (indexed), amountTokens: uint256 | 2 | 2 indexed inputs for efficient filtering |
| IssuanceControllerV3 | NAVSettled | windowId: uint256 (indexed), claimId: uint256 (indexed), holder: address (indexed), usdcPaid: uint256, remainingUSDC: uint256 | 3 | 3 indexed inputs for efficient filtering |
| IssuanceControllerV3 | NAVStruck | windowId: uint256 (indexed), strikeTs: uint256, navRayAtStrike: uint256 | 1 | 1 indexed inputs for efficient filtering |
| IssuanceControllerV3 | NAVWindowClosed | windowId: uint256 (indexed), closeTs: uint256, totalQueuedTokens: uint256 | 1 | 1 indexed inputs for efficient filtering |
| IssuanceControllerV3 | NAVWindowFullySettled | windowId: uint256 (indexed) | 1 | 1 indexed inputs for efficient filtering |
| IssuanceControllerV3 | NAVWindowOpened | windowId: uint256 (indexed), openTs: uint256, closeTs: uint256 | 1 | 1 indexed inputs for efficient filtering |
| IssuanceControllerV3 | OracleDegradationHandled | level: uint8, haircutBps: uint256, originalNav: uint256, adjustedNav: uint256 | 0 |  |
| IssuanceControllerV3 | OracleRecoveryForced | timestamp: uint256, degradationLevel: uint8 | 0 |  |
| IssuanceControllerV3 | Paused | account: address | 0 | Pause state change |
| IssuanceControllerV3 | RatificationExtended | newDeadline: uint256 | 0 |  |
| IssuanceControllerV3 | RedeemCooldownSet | seconds_: uint256 | 0 | Redemption event |
| IssuanceControllerV3 | RedeemRequested | user: address (indexed), amount: uint256 | 1 | Redemption event; 1 indexed inputs for efficient filtering |
| IssuanceControllerV3 | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| IssuanceControllerV3 | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| IssuanceControllerV3 | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| IssuanceControllerV3 | SovereignCapSet | sovereignCode: bytes32 (indexed), softCap: uint256, hardCap: uint256 | 1 | 1 indexed inputs for efficient filtering |
| IssuanceControllerV3 | SovereignUtilizationUpdated | sovereignCode: bytes32 (indexed), utilization: uint256 | 1 | 1 indexed inputs for efficient filtering |
| IssuanceControllerV3 | Strike | ts: uint256, navRay: uint256 | 0 |  |
| IssuanceControllerV3 | Unpaused | account: address | 0 | Pause state change |
| IssuanceControllerV4 | CapAdjusted | newCap: uint256 | 0 |  |
| IssuanceControllerV4 | DetachmentLowered | newBps: uint256 | 0 |  |
| IssuanceControllerV4 | DetachmentRaised | newBps: uint256, ratifyUntil: uint256 | 0 |  |
| IssuanceControllerV4 | DetachmentRatified |  | 0 |  |
| IssuanceControllerV4 | IssuanceLocked |  | 0 |  |
| IssuanceControllerV4 | IssuanceUnlocked |  | 0 |  |
| IssuanceControllerV4 | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| IssuanceControllerV4 | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| IssuanceControllerV4 | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| IssuanceControllerV4 | TriggersFired | defaultsBps: uint256, sovereignUsageBps: uint256, correlationBps: uint256, newCap: uint256, newDetachBps: uint256 | 0 |  |
| MemberRegistry | MemberSet | user: address (indexed), ok: bool | 1 | 1 indexed inputs for efficient filtering |
| MemberRegistry | PoolSet | pool: address (indexed), ok: bool | 1 | 1 indexed inputs for efficient filtering |
| MemberRegistry | RegistrarSet | registrar_: address (indexed) | 1 | 1 indexed inputs for efficient filtering |
| MemberRegistry | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| MemberRegistry | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| MemberRegistry | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| MezzanineVault | Approval | owner: address (indexed), spender: address (indexed), value: uint256 | 2 | Token approval event; 2 indexed inputs for efficient filtering |
| MezzanineVault | Deposit | sender: address (indexed), owner: address (indexed), assets: uint256, shares: uint256 | 2 | 2 indexed inputs for efficient filtering |
| MezzanineVault | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| MezzanineVault | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| MezzanineVault | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| MezzanineVault | Transfer | from: address (indexed), to: address (indexed), value: uint256 | 2 | Token transfer event; 2 indexed inputs for efficient filtering |
| MezzanineVault | Whitelist | who: address (indexed), ok: bool | 1 | 1 indexed inputs for efficient filtering |
| MezzanineVault | Withdraw | sender: address (indexed), receiver: address (indexed), owner: address (indexed), assets: uint256, shares: uint256 | 3 | 3 indexed inputs for efficient filtering |
| MezzVault4626 | Approval | owner: address (indexed), spender: address (indexed), value: uint256 | 2 | Token approval event; 2 indexed inputs for efficient filtering |
| MezzVault4626 | ConfigRegistryUpdated | newRegistry: address (indexed) | 1 | 1 indexed inputs for efficient filtering |
| MezzVault4626 | Deposit | sender: address (indexed), owner: address (indexed), assets: uint256, shares: uint256 | 2 | 2 indexed inputs for efficient filtering |
| MezzVault4626 | ForceUnlocked | acct: address (indexed) | 1 | 1 indexed inputs for efficient filtering |
| MezzVault4626 | Locked | acct: address (indexed), newUnlockTs: uint256 | 1 | 1 indexed inputs for efficient filtering |
| MezzVault4626 | Paused | account: address | 0 | Pause state change |
| MezzVault4626 | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| MezzVault4626 | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| MezzVault4626 | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| MezzVault4626 | Transfer | from: address (indexed), to: address (indexed), value: uint256 | 2 | Token transfer event; 2 indexed inputs for efficient filtering |
| MezzVault4626 | Unpaused | account: address | 0 | Pause state change |
| MezzVault4626 | WhitelistUpdated | acct: address (indexed), whitelisted: bool | 1 | 1 indexed inputs for efficient filtering |
| MezzVault4626 | Withdraw | sender: address (indexed), receiver: address (indexed), owner: address (indexed), assets: uint256, shares: uint256 | 3 | 3 indexed inputs for efficient filtering |
| NASASAGateway | ClaimSettledPayout | claimId: uint256 (indexed), owner: address (indexed), usdcPaid: uint256 | 2 | 2 indexed inputs for efficient filtering |
| NASASAGateway | InstantLaneSet | lane: address (indexed) | 1 | 1 indexed inputs for efficient filtering |
| NASASAGateway | MonthEndStrike | ts: uint256 (indexed), claimIds: uint256[], navRay: uint256 | 1 | 1 indexed inputs for efficient filtering |
| NAVOracleV3 | BandsSet | floorBps: uint256, ceilBps: uint256, maxDailyGrowthBps: uint256 | 0 |  |
| NAVOracleV3 | DegradationEntered | ts: uint256, lastNav: uint256 | 0 |  |
| NAVOracleV3 | DegradationExited | ts: uint256, nav: uint256 | 0 |  |
| NAVOracleV3 | DegradationModeToggled | enabled: bool | 0 |  |
| NAVOracleV3 | EmergencyNAVSet | navRay: uint256, ts: uint256, signer: address | 0 | Emergency state change |
| NAVOracleV3 | EmergencySignerSet | signer: address (indexed), ok: bool | 1 | Emergency state change; 1 indexed inputs for efficient filtering |
| NAVOracleV3 | HaircutParamsSet | t1: uint16, t2: uint16, t3: uint16, s1: uint256, s2: uint256, s3: uint256 | 0 | Parameter update event |
| NAVOracleV3 | ModelHashSet | modelHash: bytes32 | 0 |  |
| NAVOracleV3 | NAVUpdated | navRay: uint256, ts: uint256, nonce: uint256, modelHash: bytes32 | 0 |  |
| NAVOracleV3 | QuorumSet | quorum: uint8 | 0 |  |
| NAVOracleV3 | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| NAVOracleV3 | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| NAVOracleV3 | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| NAVOracleV3 | SignerSet | signer: address (indexed), ok: bool | 1 | 1 indexed inputs for efficient filtering |
| NAVOracleV3 | StaleThresholdSet | seconds_: uint256 | 0 |  |
| OperationalAgreement | MemberApproved | user: address (indexed) | 1 | 1 indexed inputs for efficient filtering |
| OperationalAgreement | MemberRevoked | user: address (indexed) | 1 | 1 indexed inputs for efficient filtering |
| OperationalAgreement | OperatorSet | op: address (indexed), ok: bool | 1 | 1 indexed inputs for efficient filtering |
| OperationalAgreement | PoolWhitelisted | pool: address (indexed), ok: bool | 1 | 1 indexed inputs for efficient filtering |
| OperationalAgreement | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| OperationalAgreement | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| OperationalAgreement | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| PreTrancheBuffer | BufferFunded | funder: address (indexed), amount: uint256 | 1 | 1 indexed inputs for efficient filtering |
| PreTrancheBuffer | BufferTargetUpdated | newTarget: uint256 | 0 |  |
| PreTrancheBuffer | DailyCapUpdated | newCap: uint256 | 0 |  |
| PreTrancheBuffer | EmergencyWithdraw | to: address (indexed), amount: uint256 | 1 | Emergency state change; 1 indexed inputs for efficient filtering |
| PreTrancheBuffer | InstantRedemption | user: address (indexed), amount: uint256 | 1 | 1 indexed inputs for efficient filtering |
| PreTrancheBuffer | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| PreTrancheBuffer | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| PreTrancheBuffer | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| PreTrancheBuffer | Synced | newBalance: uint256 | 0 |  |
| RedemptionClaim | ApprovalForAll | account: address (indexed), operator: address (indexed), approved: bool | 2 | Token approval event; 2 indexed inputs for efficient filtering |
| RedemptionClaim | ClaimMinted | id: uint256 (indexed), to: address (indexed), amount: uint256, strikeTs: uint256 | 2 | 2 indexed inputs for efficient filtering |
| RedemptionClaim | ClaimSettled | id: uint256 (indexed), holder: address (indexed) | 2 | 2 indexed inputs for efficient filtering |
| RedemptionClaim | ClaimStrikeSet | id: uint256 (indexed), strikeTs: uint256 | 1 | 1 indexed inputs for efficient filtering |
| RedemptionClaim | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| RedemptionClaim | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| RedemptionClaim | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| RedemptionClaim | TransferBatch | operator: address (indexed), from: address (indexed), to: address (indexed), ids: uint256[], values: uint256[] | 3 | Token transfer event; 3 indexed inputs for efficient filtering |
| RedemptionClaim | TransferSingle | operator: address (indexed), from: address (indexed), to: address (indexed), id: uint256, value: uint256 | 3 | Token transfer event; 3 indexed inputs for efficient filtering |
| RedemptionClaim | URI | value: string, id: uint256 (indexed) | 1 | 1 indexed inputs for efficient filtering |
| RedemptionQueue | ClaimQueued | claimId: uint256 (indexed), owner: address (indexed), tokens: uint256, lane: uint8 | 2 | 2 indexed inputs for efficient filtering |
| RedemptionQueue | ClaimSettled | claimId: uint256 (indexed), usdcPaid: uint256, settledAt: uint64 | 1 | 1 indexed inputs for efficient filtering |
| RedemptionQueue | ClaimStruck | claimId: uint256 (indexed), usdcOwed: uint256, struckAt: uint64 | 1 | 1 indexed inputs for efficient filtering |
| SovereignClaimSBT | Acknowledged | tokenId: uint256 (indexed) | 1 | 1 indexed inputs for efficient filtering |
| SovereignClaimSBT | Approval | owner: address (indexed), approved: address (indexed), tokenId: uint256 (indexed) | 3 | Token approval event; 3 indexed inputs for efficient filtering |
| SovereignClaimSBT | ApprovalForAll | owner: address (indexed), operator: address (indexed), approved: bool | 2 | Token approval event; 2 indexed inputs for efficient filtering |
| SovereignClaimSBT | Closed | tokenId: uint256 (indexed) | 1 | 1 indexed inputs for efficient filtering |
| SovereignClaimSBT | Filed | tokenId: uint256 (indexed), redemptionId: uint256, usdcNotional: uint256 | 1 | 1 indexed inputs for efficient filtering |
| SovereignClaimSBT | HashesSet | tokenId: uint256 (indexed), isdaAnnexHash: bytes32, docsBundleHash: bytes32 | 1 | 1 indexed inputs for efficient filtering |
| SovereignClaimSBT | PaidToSPV | tokenId: uint256 (indexed), usdcPaid: uint256 | 1 | 1 indexed inputs for efficient filtering |
| SovereignClaimSBT | Paused | account: address | 0 | Pause state change |
| SovereignClaimSBT | Reimbursed | tokenId: uint256 (indexed), usdcReimbursed: uint256 | 1 | 1 indexed inputs for efficient filtering |
| SovereignClaimSBT | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| SovereignClaimSBT | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| SovereignClaimSBT | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| SovereignClaimSBT | Transfer | from: address (indexed), to: address (indexed), tokenId: uint256 (indexed) | 3 | Token transfer event; 3 indexed inputs for efficient filtering |
| SovereignClaimSBT | Unpaused | account: address | 0 | Pause state change |
| SovereignClaimSBT | URISet | tokenId: uint256 (indexed), uri: string | 1 | 1 indexed inputs for efficient filtering |
| SovereignClaimToken | Approval | owner: address (indexed), approved: address (indexed), tokenId: uint256 (indexed) | 3 | Token approval event; 3 indexed inputs for efficient filtering |
| SovereignClaimToken | ApprovalForAll | owner: address (indexed), operator: address (indexed), approved: bool | 2 | Token approval event; 2 indexed inputs for efficient filtering |
| SovereignClaimToken | ClaimExercised | id: uint256, amount: uint256, to: address | 0 |  |
| SovereignClaimToken | ClaimUnlocked | id: uint256, reason: string | 0 |  |
| SovereignClaimToken | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| SovereignClaimToken | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| SovereignClaimToken | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| SovereignClaimToken | Transfer | from: address (indexed), to: address (indexed), tokenId: uint256 (indexed) | 3 | Token transfer event; 3 indexed inputs for efficient filtering |
| TrancheManagerV2 | CapAdjusted | cap: uint256 | 0 |  |
| TrancheManagerV2 | DetachmentRaised | lo: uint16, hi: uint16 | 0 |  |
| TrancheManagerV2 | IssuanceLocked | locked: bool | 0 |  |
| TrancheManagerV2 | RiskSignalSubmitted | signal: tuple, submitter: address (indexed) | 1 | 1 indexed inputs for efficient filtering |
| TrancheManagerV2 | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| TrancheManagerV2 | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| TrancheManagerV2 | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| TrancheManagerV2 | SoftCapExpanded | newHi: uint16, reason: string, expiry: uint256 | 0 |  |
| TrancheManagerV2 | SoftCapReverted | lo: uint16, hi: uint16, reason: string | 0 |  |
| TrancheManagerV2 | SovereignGuaranteeConfirmed | confirmed: bool | 0 |  |
| TrancheManagerV2 | SupermajorityAttested | yesBps: uint256, ts: uint256 | 0 |  |
| TrancheManagerV2 | ThresholdsUpdated | sovereignUsageBps: uint64, defaultsBps: uint64, corrPpm: uint32 | 0 |  |
| TrancheManagerV2 | Tier2Expansion | newHi: uint16, claimId: uint256, expiry: uint256 | 0 |  |
| TrancheManagerV2 | Tier2Reverted | lo: uint16, hi: uint16, reason: string | 0 |  |
| TrancheManagerV2 | TranchingModeChanged | mode: uint8, governor: address (indexed) | 1 | 1 indexed inputs for efficient filtering |
| TrancheManagerV2 | TriggersBreachedSet | breached: bool | 0 |  |
| Treasury | AutoPauseTriggered | level: uint256, shortfallBps: uint256 | 0 |  |
| Treasury | BufferRestored | level: uint256, balance: uint256 | 0 |  |
| Treasury | BufferShortfall | level: uint256, target: uint256, balance: uint256 | 0 |  |
| Treasury | BufferTargetSet | bps: uint256 | 0 |  |
| Treasury | Funded | token: address (indexed), amount: uint256 | 1 | 1 indexed inputs for efficient filtering |
| Treasury | Paid | token: address (indexed), to: address (indexed), amount: uint256 | 2 | 2 indexed inputs for efficient filtering |
| Treasury | RoleAdminChanged | role: bytes32 (indexed), previousAdminRole: bytes32 (indexed), newAdminRole: bytes32 (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| Treasury | RoleGranted | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
| Treasury | RoleRevoked | role: bytes32 (indexed), account: address (indexed), sender: address (indexed) | 3 | Access control event; 3 indexed inputs for efficient filtering |
