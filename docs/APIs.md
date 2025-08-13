# BRICS Protocol APIs

## Overview
BRICS Protocol provides both on-chain and off-chain APIs for member-gated access, risk management, and emergency operations. All APIs require member authentication and follow strict security protocols.

> **For administrative procedures and governance operations, see the [Admin Governance Guide](ADMIN-GOVERNANCE.md).**

## Authentication
- **Member Gating**: All endpoints require valid member credentials
- **Rate Limiting**: 100 requests/minute per member
- **Audit Logging**: All requests logged for compliance

## On-Chain APIs

### NASASAGateway

#### Instant Lane Redemption
**Contract**: `NASASAGateway`

**Function**: `canInstantRedeem(address member, uint256 tokens18) → (bool ok, uint256 capUSDC, uint256 usedUSDC, uint256 needUSDC)`

**Description**: Check if a member can perform instant redemption for a given amount of BRICS tokens

**Parameters**:
- `member`: Member address to check
- `tokens18`: BRICS token amount in 18 decimals

**Returns**:
- `ok`: Whether redemption is allowed
- `capUSDC`: Daily cap in USDC (6 decimals)
- `usedUSDC`: Used amount today in USDC (6 decimals)
- `needUSDC`: Required USDC for the redemption (6 decimals)

**Requirements**: Instant lane must be set via `setInstantLane()`

**Error**: `"GW/INSTANT_UNSET"` if instant lane not configured

---

**Function**: `redeemInstant(uint256 tokens18) → uint256 usdcOut`

**Description**: Perform instant redemption of BRICS tokens for USDC via AMM

**Parameters**:
- `tokens18`: BRICS token amount to redeem (18 decimals)

**Returns**:
- `usdcOut`: USDC amount received (6 decimals)

**Requirements**:
- Caller must be a member
- Instant lane must be set
- Sufficient BRICS allowance for instant lane
- Within daily cap limits
- AMM price within bounds

**Errors**:
- `"GW/INSTANT_UNSET"`: Instant lane not configured
- `IL_NOT_MEMBER`: Caller is not a member
- `IL_CAP_EXCEEDED`: Daily cap exceeded
- `IL_BOUNDS`: AMM price outside allowed bounds

---

**Function**: `setInstantLane(address lane)`

**Description**: Set the instant lane contract (owner only)

**Parameters**:
- `lane`: Address of InstantLane contract

**Events**: `InstantLaneSet(address indexed lane)`

### NAVOracleV3

#### Read Functions
**Contract**: `NAVOracleV3`

**Function**: `latestNAVRay() → uint256`

**Description**: Get current NAV in ray format (1e27 precision). Returns emergency NAV if in emergency mode.

**Returns**: NAV value in ray format (1e27 precision)

---

**Function**: `lastUpdateTs() → uint256`

**Description**: Get timestamp of last NAV update

**Returns**: Unix timestamp of last update

---

**Function**: `isEmergency() → bool`

**Description**: Check if oracle is in emergency mode

**Returns**: True if emergency mode is active

---

### Safety & Policy Checks

#### NAV/TWAP Sanity Guard (Mock Oracle)
**Contract**: `MockNAVOracle`

**Function**: `setMaxJumpBps(uint256 bps)`

**Description**: Set maximum allowed NAV jump in basis points (default: 500 = 5%)

**Parameters**:
- `bps`: Maximum jump in basis points

---

**Function**: `setEmergency(bool on)`

**Description**: Enable/disable emergency mode to allow large NAV jumps

**Parameters**:
- `on`: True to enable emergency mode, false to disable

---

**Function**: `setNavRay(uint256 navRay)`

**Description**: Set NAV value with sanity check (reverts if jump exceeds maxJumpBps unless emergency enabled)

**Parameters**:
- `navRay`: NAV value in ray format (1e27 precision)

**Errors**:
- `"NAV_JUMP"`: NAV change exceeds maximum allowed jump

---

#### Lane Pre-Trade Check
**Contract**: `InstantLane`

**Function**: `preTradeCheck(uint256 priceBps, uint8 emergencyLevel) → (bool ok, uint256 minBps, uint256 maxBps)`

**Description**: Check if a candidate price is within current bounds for the given emergency level (view function, no state change)

**Parameters**:
- `priceBps`: Price in basis points (e.g., 10000 = 100%)
- `emergencyLevel`: Emergency level to check bounds for

**Returns**:
- `ok`: Whether the price is within bounds
- `minBps`: Minimum allowed price in basis points
- `maxBps`: Maximum allowed price in basis points

**Emergency Level Bounds**:
- Level 0 (Normal): 9800-10200 bps (±2%)
- Level 1 (Amber): 9900-10100 bps (±1%)
- Level 2 (Red): 9975-10025 bps (±0.25%)

---

## Risk API

### Safety & Policy (v1)

#### Lane Pre-Trade Check
**Endpoint**: `GET /api/v1/lane/pretrade`

**Description**: Check if a candidate price is within current bounds for the given emergency level (view function, no state change)

**Query Parameters**:
- `price_bps` (int, required): Price in basis points (e.g., 10000 = 100%)
- `emergency_level` (int, required): Emergency level to check bounds for
- `lane_addr` (string, optional): Lane contract address (defaults to .devstack/addresses.json or LANE_ADDR env)

**Response** (signed):
```json
{
  "ok": 1,
  "min_bps": 9800,
  "max_bps": 10200,
  "price_bps": 10000,
  "emergency_level": 0,
  "ts": 1755067422,
  "sig": "4aaab42a5562c943c0b2b0ea1fd655b996a6f096a9da1bb7eade21799d2d39f7e0b1ef09b148ca14c9b636184ee5a507be442a459a40b1720c461c3454b36a0f"
}
```

**Behavior**: Deterministic, no RPC dependency. Emulates lane bounds with same logic as `_boundsForLevel()`.

**Example Request**:
```bash
curl "http://localhost:8000/api/v1/lane/pretrade?price_bps=10050&emergency_level=0"
```

---

#### NAV Sanity Check
**Endpoint**: `GET /api/v1/oracle/nav-sanity`

**Description**: Check if a proposed NAV change is within allowed bounds

**Query Parameters**:
- `proposed_nav_ray` (int, required): Proposed NAV in ray format (1e27 precision)
- `max_jump_bps` (int, optional): Maximum allowed jump in basis points (default: 500 = 5%)
- `emergency` (int, optional): Whether emergency mode is enabled (0/1, default: 0)
- `prev_nav_ray` (int, optional): Previous NAV in ray format (defaults to 1.0 RAY if not provided)

**Response** (signed):
```json
{
  "ok": 1,
  "prev_nav_ray": 1000000000000000000000000000,
  "proposed_nav_ray": 1049000000000000000000000000,
  "max_jump_bps": 500,
  "emergency_enabled": 0,
  "assumed_prev": 0,
  "ts": 1755067431,
  "sig": "ef46aae1a98c4a7265e9423f155d6d04d0efe4fbd009b3dca4da2e37abf15dc39a3ba0ce6bea0d23beaf8729340f306d613371130319dcc8f04cfadfba2dc90c"
}
```

**Behavior**: Pure function, no chain calls. Emulates the same guard logic used in MockNAVOracle tests.

**Notes**:
- If `prev_nav_ray` is not provided, uses 1.0 RAY as default and sets `assumed_prev: 1`
- `assumed_prev: 1` indicates the previous NAV was assumed (clients should be aware)

**Example Request**:
```bash
curl "http://localhost:8000/api/v1/oracle/nav-sanity?prev_nav_ray=1000000000000000000000000000&proposed_nav_ray=1049000000000000000000000000&max_jump_bps=500&emergency=0"
```

---

**Function**: `modelHash() → bytes32`

**Description**: Get current model hash for signature verification

**Returns**: Current model hash

#### Admin/Operations Functions

**Function**: `submitNAV(uint256 navRay, uint256 ts, bytes[] calldata sigs)`

**Description**: Submit NAV with EIP-712 signatures from authorized signers

**Parameters**:
- `navRay`: NAV value in ray format (1e27 precision)
- `ts`: Timestamp of NAV calculation
- `sigs`: Array of EIP-712 signatures from authorized signers

**Requirements**:
- Sufficient signatures to meet quorum requirement
- Fresh timestamp (not older than maxAgeSec)
- Valid EIP-712 signatures with current model hash
- No duplicate signatures

**Events**: `NAVSubmitted(uint256 navRay, uint256 ts)`

**Errors**:
- `"ORACLE/INVALID_NAV"`: NAV value is zero
- `"ORACLE/STALE_OR_REPLAY"`: Timestamp is stale or replay
- `"ORACLE/QUORUM"`: Insufficient valid signatures
- `"ORACLE/DUPLICATE_SIG"`: Duplicate signature detected

---

**Function**: `rotateSigners(address[] calldata newSigners)`

**Description**: Rotate authorized signers (owner only)

**Parameters**:
- `newSigners`: Array of new signer addresses

**Requirements**: Owner only, non-empty signer array, quorum ≤ signer count

**Events**: `SignersRotated(address[] newSigners)`

**Errors**:
- `"GW/NOT_OWNER"`: Caller is not owner
- `"ORACLE/NO_SIGNERS"`: Empty signer array
- `"ORACLE/QUORUM_TOO_HIGH"`: Quorum exceeds signer count

---

**Function**: `updateQuorum(uint256 newQuorum)`

**Description**: Update required quorum for NAV submissions (owner only)

**Parameters**:
- `newQuorum`: New quorum requirement

**Requirements**: Owner only, quorum ≥ minQuorum and ≤ signer count

**Events**: `QuorumUpdated(uint256 newQuorum)`

**Errors**:
- `"GW/NOT_OWNER"`: Caller is not owner
- `"ORACLE/INVALID_QUORUM"`: Invalid quorum value

---

**Function**: `rollModelHash(bytes32 newModelHash)`

**Description**: Roll model hash for signature verification (owner only)

**Parameters**:
- `newModelHash`: New model hash

**Requirements**: Owner only

**Events**: `ModelHashRolled(bytes32 newModelHash)`

**Errors**:
- `"GW/NOT_OWNER"`: Caller is not owner

---

**Function**: `enableEmergencyNAV(uint256 emergencyNavRay)`

**Description**: Enable emergency mode with specified NAV (owner only)

**Parameters**:
- `emergencyNavRay`: Emergency NAV value in ray format

**Requirements**: Owner only, non-zero NAV value

**Events**: `EmergencyEnabled(uint256 navRay)`

**Errors**:
- `"GW/NOT_OWNER"`: Caller is not owner
- `"ORACLE/INVALID_NAV"`: NAV value is zero

---

**Function**: `disableEmergencyNAV()`

**Description**: Disable emergency mode (owner only)

**Requirements**: Owner only

**Events**: `EmergencyDisabled()`

**Errors**:
- `"GW/NOT_OWNER"`: Caller is not owner

#### EIP-712 Signature Schema

**Domain**:
```json
{
  "name": "BRICS-NAV",
  "version": "3",
  "chainId": <network_chain_id>,
  "verifyingContract": "<oracle_address>"
}
```

**Types**:
```json
{
  "NAV": [
    { "name": "navRay", "type": "uint256" },
    { "name": "ts", "type": "uint256" },
    { "name": "modelHash", "type": "bytes32" }
  ]
}
```

**Example Payload**:
```json
{
  "navRay": "1050000000000000000000000000",
  "ts": 1640995200,
  "modelHash": "0x1234567890abcdef..."
}
```

#### Configuration Keys

The oracle reads configuration from ConfigRegistry:

- `keccak256("oracle.maxAgeSec")` → Maximum age of NAV submissions (default: 3600s)
- `keccak256("oracle.degradeAfterSec")` → Auto-degradation threshold (default: 7200s)
- `keccak256("oracle.minQuorum")` → Minimum quorum requirement (default: 1)

### NASASAGateway
```solidity
interface INASASAGateway {
    function mint(uint256 usdcAmount, address recipient) external;
    function redeem(uint256 tokenAmount, RedemptionLane lane) external;
    function processMonthEndStrike() external;
    function settleClaim(uint256 claimId) external;
    function canInstantRedeem(address member, uint256 amount) external view returns (bool);
}
```

### ConfigRegistry
```solidity
interface IConfigRegistry {
    struct CurrentParams {
        uint256 ammMaxSlippageBps;
        uint256 redeemCapBps;
        uint256 emergencyLevel;
    }
    
    function emergencyLevel() external view returns (uint256);
    function redeemCapBps() external view returns (uint256);
    function getCurrentParams() external view returns (CurrentParams memory);
}
```

### MezzVault4626

#### State Variables
**Contract**: `MezzVault4626`

**Variable**: `minUnlockTs(address account) → uint256`

**Description**: Minimum unlock timestamp for an account

---

**Variable**: `whitelist(address account) → bool`

**Description**: Whether an account is whitelisted for operational exits

---

**Variable**: `configRegistry() → address`

**Description**: Address of the ConfigRegistry contract

#### ERC-4626 Functions

**Function**: `deposit(uint256 assets, address receiver) → uint256 shares`

**Description**: Deposit assets and receive vault shares (extends lock)

**Parameters**:
- `assets`: Amount of underlying assets to deposit
- `receiver`: Address to receive vault shares

**Returns**: Number of vault shares minted

**Lock Behavior**: Sets or extends `minUnlockTs[receiver]`

**Events**: `Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares)`, `Locked(address indexed acct, uint256 newUnlockTs)`

---

**Function**: `mint(uint256 shares, address receiver) → uint256 assets`

**Description**: Mint vault shares for assets (extends lock)

**Parameters**:
- `shares`: Number of vault shares to mint
- `receiver`: Address to receive vault shares

**Returns**: Amount of underlying assets deposited

**Lock Behavior**: Sets or extends `minUnlockTs[receiver]`

**Events**: `Mint(address indexed caller, address indexed owner, uint256 assets, uint256 shares)`, `Locked(address indexed acct, uint256 newUnlockTs)`

---

**Function**: `withdraw(uint256 assets, address receiver, address owner) → uint256 shares`

**Description**: Withdraw assets by burning vault shares

**Parameters**:
- `assets`: Amount of underlying assets to withdraw
- `receiver`: Address to receive underlying assets
- `owner`: Address that owns the vault shares

**Returns**: Number of vault shares burned

**Requirements**: `block.timestamp >= minUnlockTs[owner]` OR `whitelist[owner] == true`

**Grace Window**: Full withdrawal within grace window resets lock

**Events**: `Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)`

**Errors**:
- `"MV/LOCKED"`: Withdrawal attempted before unlock
- `"MV/PAUSED"`: Vault is paused

---

**Function**: `redeem(uint256 shares, address receiver, address owner) → uint256 assets`

**Description**: Redeem vault shares for underlying assets

**Parameters**:
- `shares`: Number of vault shares to redeem
- `receiver`: Address to receive underlying assets
- `owner`: Address that owns the vault shares

**Returns**: Amount of underlying assets withdrawn

**Requirements**: `block.timestamp >= minUnlockTs[owner]` OR `whitelist[owner] == true`

**Grace Window**: Full withdrawal within grace window resets lock

**Events**: `Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)`

**Errors**:
- `"MV/LOCKED"`: Withdrawal attempted before unlock
- `"MV/PAUSED"`: Vault is paused

#### View Functions

**Function**: `minUnlockOf(address account) → uint256`

**Description**: Get the minimum unlock timestamp for an account

**Parameters**:
- `account`: Address to check

**Returns**: Unix timestamp when account can withdraw

---

**Function**: `isLocked(address account) → bool`

**Description**: Check if an account is currently locked

**Parameters**:
- `account`: Address to check

**Returns**: True if account cannot withdraw

---

**Function**: `canWithdraw(address account) → bool`

**Description**: Check if an account can withdraw

**Parameters**:
- `account`: Address to check

**Returns**: True if account can withdraw

#### Governance Functions

**Function**: `setConfigRegistry(address newRegistry)`

**Description**: Update the ConfigRegistry address (GOV_ROLE only)

**Parameters**:
- `newRegistry`: New ConfigRegistry address

**Events**: `ConfigRegistryUpdated(address indexed newRegistry)`

**Errors**:
- `"MV/ONLY_GOV"`: Caller is not GOV_ROLE
- `"MV/ZERO_ADDRESS"`: New registry is zero address

---

**Function**: `setWhitelist(address account, bool whitelisted)`

**Description**: Add or remove account from operational whitelist (GOV_ROLE only)

**Parameters**:
- `account`: Address to whitelist/unwhitelist
- `whitelisted`: True to whitelist, false to remove

**Events**: `WhitelistUpdated(address indexed acct, bool whitelisted)`

**Errors**:
- `"MV/ONLY_GOV"`: Caller is not GOV_ROLE

---

**Function**: `pause()`

**Description**: Pause all vault operations (GOV_ROLE only)

**Events**: `Paused(address indexed account)`

**Errors**:
- `"MV/ONLY_GOV"`: Caller is not GOV_ROLE

---

**Function**: `unpause()`

**Description**: Unpause vault operations (GOV_ROLE only)

**Events**: `Unpaused(address indexed account)`

**Errors**:
- `"MV/ONLY_GOV"`: Caller is not GOV_ROLE

---

**Function**: `forceUnlock(address[] calldata users)`

**Description**: Force unlock specific users (EMERGENCY_ROLE only)

**Parameters**:
- `users`: Array of addresses to unlock

**Events**: `ForceUnlocked(address indexed acct)` for each user

**Errors**:
- `"MV/ONLY_EMERGENCY"`: Caller is not EMERGENCY_ROLE

#### Configuration Keys

The vault reads configuration from ConfigRegistry:

- `keccak256("mezz.lock.durationSec")` → Lock duration in seconds (default: 5 years)
- `keccak256("mezz.lock.graceSec")` → Grace window in seconds (default: 30 days)

#### Sample Flows

**Normal Deposit and Withdrawal**:
```solidity
// 1. Deposit assets (sets 5-year lock)
uint256 shares = vault.deposit(1000e18, user);

// 2. Check lock status
uint256 unlockTs = vault.minUnlockOf(user);
bool isLocked = vault.isLocked(user);

// 3. Wait for unlock (5 years later)
// 4. Withdraw assets
uint256 assets = vault.withdraw(1000e18, user, user);
```

**Emergency Force Unlock**:
```solidity
// Emergency role unlocks specific users
vault.forceUnlock([user1, user2, user3]);

// Users can now withdraw immediately
vault.withdraw(1000e18, user1, user1);
```

**Grace Window Withdrawal**:
```solidity
// After unlock time, within grace window
uint256 balance = vault.balanceOf(user);
vault.withdraw(balance, user, user); // Full withdrawal resets lock
```

### SovereignClaimSBT

#### State Variables
**Contract**: `SovereignClaimSBT`

**Variable**: `_tokenIdCounter() → uint256`

**Description**: Current token ID counter (starts at 1)

---

**Variable**: `_claims(uint256 tokenId) → Claim`

**Description**: Claim data for a specific token ID

**Returns**: Claim struct with all lifecycle data

---

**Variable**: `_baseTokenURI() → string`

**Description**: Base URI for token metadata

#### Lifecycle Functions

**Function**: `fileClaim(address to, uint256 redemptionId, uint256 usdcNotional, bytes32 isdaAnnexHash, bytes32 docsBundleHash, string calldata evidenceURI) → uint256 tokenId`

**Description**: File a new sovereign claim and mint SBT

**Parameters**:
- `to`: Address to receive the SBT
- `redemptionId`: Link to RedemptionQueue claimId
- `usdcNotional`: Requested/paid amount in USDC (6 decimals)
- `isdaAnnexHash`: Hash of signed ISDA annex/amendment
- `docsBundleHash`: Hash of evidence pack
- `evidenceURI`: Optional IPFS or HTTPS URI

**Returns**: Token ID of the minted SBT

**Requirements**: Caller must have GOV_ROLE or ECC_ROLE

**Events**: `Filed(uint256 indexed tokenId, uint256 redemptionId, uint256 usdcNotional)`

**Errors**:
- `"SBT/ONLY_ROLE"`: Caller lacks required role
- `"SBT/PAUSED"`: Contract is paused

---

**Function**: `acknowledge(uint256 tokenId)`

**Description**: Acknowledge a filed claim

**Parameters**:
- `tokenId`: Token ID to acknowledge

**Requirements**: Caller must have SOV_ROLE, status must be Filed

**Events**: `Acknowledged(uint256 indexed tokenId)`

**Errors**:
- `"SBT/ONLY_ROLE"`: Caller lacks SOV_ROLE
- `"SBT/ONLY_FORWARD"`: Status not progressing forward
- `"SBT/PAUSED"`: Contract is paused

---

**Function**: `markPaidToSPV(uint256 tokenId, uint256 usdcPaid)`

**Description**: Mark payment made to Special Purpose Vehicle

**Parameters**:
- `tokenId`: Token ID to update
- `usdcPaid`: Amount paid in USDC (6 decimals)

**Requirements**: Caller must have SOV_ROLE, status must be Acknowledged

**Events**: `PaidToSPV(uint256 indexed tokenId, uint256 usdcPaid)`

**Errors**:
- `"SBT/ONLY_ROLE"`: Caller lacks SOV_ROLE
- `"SBT/ONLY_FORWARD"`: Status not progressing forward
- `"SBT/PAUSED"`: Contract is paused

---

**Function**: `markReimbursed(uint256 tokenId, uint256 usdcReimbursed)`

**Description**: Mark reimbursement by sovereign

**Parameters**:
- `tokenId`: Token ID to update
- `usdcReimbursed`: Amount reimbursed in USDC (6 decimals)

**Requirements**: Caller must have SOV_ROLE or GOV_ROLE, status must be PaidToSPV

**Events**: `Reimbursed(uint256 indexed tokenId, uint256 usdcReimbursed)`

**Errors**:
- `"SBT/ONLY_ROLE"`: Caller lacks required role
- `"SBT/ONLY_FORWARD"`: Status not progressing forward
- `"SBT/PAUSED"`: Contract is paused

---

**Function**: `close(uint256 tokenId)`

**Description**: Close a fully settled claim

**Parameters**:
- `tokenId`: Token ID to close

**Requirements**: Caller must have GOV_ROLE, status must be ReimbursedBySovereign

**Events**: `Closed(uint256 indexed tokenId)`

**Errors**:
- `"SBT/ONLY_ROLE"`: Caller lacks GOV_ROLE
- `"SBT/ONLY_FORWARD"`: Status not progressing forward
- `"SBT/PAUSED"`: Contract is paused

#### Metadata Functions

**Function**: `setHashes(uint256 tokenId, bytes32 isdaAnnexHash, bytes32 docsBundleHash)`

**Description**: Update ISDA annex and docs bundle hashes

**Parameters**:
- `tokenId`: Token ID to update
- `isdaAnnexHash`: New ISDA annex hash
- `docsBundleHash`: New docs bundle hash

**Requirements**: Caller must have GOV_ROLE, status must be Filed or Acknowledged

**Events**: `HashesSet(uint256 indexed tokenId, bytes32 isdaAnnexHash, bytes32 docsBundleHash)`

**Errors**:
- `"SBT/ONLY_ROLE"`: Caller lacks GOV_ROLE
- `"SBT/INVALID_STATUS"`: Status not in editable window
- `"SBT/PAUSED"`: Contract is paused

---

**Function**: `setEvidenceURI(uint256 tokenId, string calldata uri)`

**Description**: Update evidence URI (always allowed)

**Parameters**:
- `tokenId`: Token ID to update
- `uri`: New evidence URI

**Requirements**: Caller must have GOV_ROLE

**Events**: `URISet(uint256 indexed tokenId, string uri)`

**Errors**:
- `"SBT/ONLY_ROLE"`: Caller lacks GOV_ROLE
- `"SBT/PAUSED"`: Contract is paused

#### View Functions

**Function**: `getClaim(uint256 tokenId) → Claim memory`

**Description**: Get complete claim data for a token

**Parameters**:
- `tokenId`: Token ID to query

**Returns**: Claim struct with all lifecycle data

---

**Function**: `getStatus(uint256 tokenId) → ClaimStatus`

**Description**: Get current status of a claim

**Parameters**:
- `tokenId`: Token ID to query

**Returns**: Current ClaimStatus enum value

---

**Function**: `getRedemptionId(uint256 tokenId) → uint256`

**Description**: Get redemption ID for a token

**Parameters**:
- `tokenId`: Token ID to query

**Returns**: RedemptionQueue claimId

---

**Function**: `getUsdcNotional(uint256 tokenId) → uint256`

**Description**: Get USDC notional amount for a token

**Parameters**:
- `tokenId`: Token ID to query

**Returns**: USDC notional amount (6 decimals)

#### Governance Functions

**Function**: `burn(uint256 tokenId)`

**Description**: Burn a closed SBT (cleanup)

**Parameters**:
- `tokenId`: Token ID to burn

**Requirements**: Caller must have GOV_ROLE or be token owner, status must be Closed

**Errors**:
- `"SBT/ONLY_ROLE"`: Caller lacks required permissions
- `"SBT/INVALID_STATUS"`: Token not in Closed status

---

**Function**: `pause()`

**Description**: Pause all operations (GOV_ROLE only)

**Events**: `Paused(address indexed account)`

**Errors**:
- `"SBT/ONLY_ROLE"`: Caller lacks GOV_ROLE

---

**Function**: `unpause()`

**Description**: Unpause operations (GOV_ROLE only)

**Events**: `Unpaused(address indexed account)`

**Errors**:
- `"SBT/ONLY_ROLE"`: Caller lacks GOV_ROLE

---

**Function**: `setBaseURI(string memory baseURI)`

**Description**: Set base URI for token metadata (GOV_ROLE only)

**Parameters**:
- `baseURI`: New base URI

**Errors**:
- `"SBT/ONLY_ROLE"`: Caller lacks GOV_ROLE

#### Soulbound Enforcement

All ERC-721 transfer functions are overridden to prevent transfers:

**Function**: `approve(address to, uint256 tokenId)`

**Description**: Reverts with "SBT/NO_TRANSFER"

---

**Function**: `setApprovalForAll(address operator, bool approved)`

**Description**: Reverts with "SBT/NO_TRANSFER"

---

**Function**: `transferFrom(address from, address to, uint256 tokenId)`

**Description**: Reverts with "SBT/NO_TRANSFER"

---

**Function**: `safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data)`

**Description**: Reverts with "SBT/NO_TRANSFER"

#### Data Structures

**Claim Struct**:
```solidity
struct Claim {
    uint256 redemptionId;      // Link to RedemptionQueue claimId
    uint256 usdcNotional;      // Requested/paid amount (6d)
    uint64  filedAt;           // Timestamp when filed
    uint64  ackAt;             // Timestamp when acknowledged
    uint64  paidAt;            // Timestamp when paid to SPV
    uint64  reimbursedAt;      // Timestamp when reimbursed
    uint64  closedAt;          // Timestamp when closed
    bytes32 isdaAnnexHash;     // Hash of signed ISDA annex
    bytes32 docsBundleHash;    // Hash of evidence pack
    string  evidenceURI;       // Optional IPFS/HTTPS URI
    ClaimStatus status;        // Current lifecycle status
}
```

**ClaimStatus Enum**:
```solidity
enum ClaimStatus {
    Filed,                     // 0: Initial claim filed
    Acknowledged,              // 1: Sovereign acknowledged
    PaidToSPV,                 // 2: Payment made to SPV
    ReimbursedBySovereign,     // 3: Sovereign reimbursed
    Closed                     // 4: Claim fully settled
}
```

#### Sample Flows

**Complete Claim Lifecycle**:
```solidity
// 1. File claim (GOV_ROLE or ECC_ROLE)
uint256 tokenId = sbt.fileClaim(
    user,
    redemptionId,
    1000000, // 1M USDC
    isdaHash,
    docsHash,
    "ipfs://evidence"
);

// 2. Acknowledge claim (SOV_ROLE)
sbt.acknowledge(tokenId);

// 3. Mark payment to SPV (SOV_ROLE)
sbt.markPaidToSPV(tokenId, 1000000);

// 4. Mark reimbursement (SOV_ROLE or GOV_ROLE)
sbt.markReimbursed(tokenId, 1000000);

// 5. Close claim (GOV_ROLE)
sbt.close(tokenId);

// 6. Optional: Burn SBT for cleanup
sbt.burn(tokenId);
```

**Documentation Updates**:
```solidity
// Update hashes during Filed/Acknowledged status
sbt.setHashes(tokenId, newIsdaHash, newDocsHash);

// Update evidence URI anytime
sbt.setEvidenceURI(tokenId, "https://new-evidence.com");
```

**Status Queries**:
```solidity
// Get complete claim data
Claim memory claim = sbt.getClaim(tokenId);

// Get specific fields
ClaimStatus status = sbt.getStatus(tokenId);
uint256 redemptionId = sbt.getRedemptionId(tokenId);
uint256 usdcNotional = sbt.getUsdcNotional(tokenId);
```

### IssuanceControllerV4

#### State Variables
**Contract**: `IssuanceControllerV4`

**Variable**: `superSeniorCap() → uint256`

**Description**: Current issuance cap in BRICS tokens (1e18 precision)

---

**Variable**: `detachmentBps() → uint256`

**Description**: Current detachment level in basis points (e.g., 10100 = 101.00%)

---

**Variable**: `lastDetachmentRaiseTs() → uint256`

**Description**: Timestamp of last detachment raise

---

**Variable**: `issuanceLocked() → bool`

**Description**: Whether issuance is manually locked

---

**Variable**: `pendingRatifyUntil() → uint256`

**Description**: Ratification deadline timestamp (0 if no pending ratification)

#### Governance Functions

**Function**: `setSuperSeniorCap(uint256 newCap)`

**Description**: Adjust the super senior issuance cap (GOV_ROLE only)

**Parameters**:
- `newCap`: New issuance cap in BRICS tokens

**Events**: `CapAdjusted(uint256 newCap)`

**Errors**:
- `"IC/ONLY_GOV"`: Caller is not GOV_ROLE

---

**Function**: `raiseDetachment(uint256 newBps)`

**Description**: Raise detachment level with 24h ratification window (GOV_ROLE only)

**Parameters**:
- `newBps`: New detachment level in basis points

**Requirements**: `newBps > current detachmentBps`

**Events**: `DetachmentRaised(uint256 newBps, uint256 ratifyUntil)`

**Errors**:
- `"IC/ONLY_GOV"`: Caller is not GOV_ROLE
- `"IC/ONLY_UP"`: New detachment not higher than current

---

**Function**: `lowerDetachment(uint256 newBps)`

**Description**: Lower detachment level (GOV_ROLE only, requires cooldown)

**Parameters**:
- `newBps`: New detachment level in basis points

**Requirements**: 
- `newBps < current detachmentBps`
- `block.timestamp >= lastDetachmentRaiseTs + cooldown`
- `pendingRatifyUntil == 0`

**Events**: `DetachmentLowered(uint256 newBps)`

**Errors**:
- `"IC/ONLY_GOV"`: Caller is not GOV_ROLE
- `"IC/ONLY_DOWN"`: New detachment not lower than current
- `"IC/COOLDOWN"`: Cooldown period not elapsed
- `"IC/PENDING_RATIFY"`: Pending ratification window active

---

**Function**: `ratifyDetachment()`

**Description**: Ratify detachment raise within 24h window (GOV_ROLE only)

**Requirements**: 
- `pendingRatifyUntil > 0`
- `block.timestamp <= pendingRatifyUntil`

**Events**: `DetachmentRatified()`

**Errors**:
- `"IC/ONLY_GOV"`: Caller is not GOV_ROLE
- `"IC/NO_PENDING"`: No pending ratification
- `"IC/RATIFY_EXPIRED"`: Ratification window expired

---

**Function**: `lockIssuance()`

**Description**: Lock all issuance (ECC_ROLE only)

**Events**: `IssuanceLocked()`

**Errors**:
- `"IC/ONLY_ECC"`: Caller is not ECC_ROLE

---

**Function**: `unlockIssuance()`

**Description**: Unlock issuance (ECC_ROLE only)

**Events**: `IssuanceUnlocked()`

**Errors**:
- `"IC/ONLY_ECC"`: Caller is not ECC_ROLE

---

**Function**: `adjustByTriggers(uint256 currentDefaultsBps, uint256 sovereignUsageBps, uint256 correlationBps)`

**Description**: Adjust cap and detachment based on risk triggers (ECC_ROLE only)

**Parameters**:
- `currentDefaultsBps`: Current defaults in basis points
- `sovereignUsageBps`: Sovereign usage in basis points
- `correlationBps`: Correlation in basis points

**Trigger Thresholds**:
- Sovereign Usage > 20% (2000 bps): 10% cap reduction, +1% detachment
- Defaults > 5% (500 bps): 15% cap reduction, +2% detachment
- Correlation > 65% (6500 bps): 20% cap reduction, +3% detachment

**Events**: `TriggersFired(uint256 defaultsBps, uint256 sovereignUsageBps, uint256 correlationBps, uint256 newCap, uint256 newDetachBps)`

**Errors**:
- `"IC/ONLY_ECC"`: Caller is not ECC_ROLE

#### Mint Gate Functions

**Function**: `checkMintAllowed(uint256 tokens) → bool`

**Description**: Check if minting is allowed under current conditions

**Parameters**:
- `tokens`: Amount of tokens to mint

**Returns**: True if minting is allowed

**Checks**:
1. Issuance not locked
2. Emergency level not RED
3. Ratification window not expired
4. Within issuance cap

**Errors**:
- `"IC/LOCKED"`: Issuance manually locked
- `"IC/RED_HALT"`: Emergency level RED
- `"IC/RATIFY_EXPIRED"`: Ratification window expired
- `"IC/CAP"`: Exceeds issuance cap

---

**Function**: `canMint(uint256 tokens) → bool`

**Description**: Safe view function to check minting allowance

**Parameters**:
- `tokens`: Amount of tokens to mint

**Returns**: True if minting would be allowed

---

**Function**: `getCurrentState() → (uint256 cap, uint256 detachment, bool locked, uint256 ratifyUntil, uint256 emergencyLevel)`

**Description**: Get comprehensive current state

**Returns**:
- `cap`: Current super senior cap
- `detachment`: Current detachment BPS
- `locked`: Whether issuance is locked
- `ratifyUntil`: Pending ratification deadline
- `emergencyLevel`: Current emergency level

#### Configuration Keys

The controller reads configuration from ConfigRegistry:

- `keccak256("emergency.level")` → Emergency level (0=GREEN, 1=AMBER, 2=RED)
- `keccak256("issuance.detach.cooldownSec")` → Detachment cooldown period (default: 7 days)

### NAVOracleV3
```solidity
interface INAVOracleV3 {
    function navRay() external view returns (uint256);
    function modelHash() external view returns (bytes32);
    function degradationLevel() external view returns (uint8);
}
```

## Risk FastAPI Endpoints

### Base URL
```
https://api.brics-protocol.com/v1
```

### 1. NAV Latest
**Endpoint**: `GET /nav/latest`

**Description**: Get current NAV with model hash and timestamp

**Response**:
```json
{
  "nav": "1.000000000000000000",
  "timestamp": 1640995200,
  "model_hash": "0x1234567890abcdef...",
  "version": "v1.0.0",
  "degradation_level": "NORMAL",
  "signer_count": 3,
  "quorum_met": true
}
```

**Error Codes**:
- `401`: Unauthorized (non-member)
- `503`: Oracle degraded
- `429`: Rate limit exceeded

### 2. Emergency Level
**Endpoint**: `GET /emergency/level`

**Description**: Get current emergency state and triggers

**Response**:
```json
{
  "level": "NORMAL",
  "triggers": ["buffer_health", "oracle_staleness"],
  "time_in_state": 86400,
  "next_assessment": 1641081600,
  "escalation_thresholds": {
    "buffer_ratio": 0.5,
    "oracle_staleness_hours": 6,
    "tail_correlation": 0.8
  }
}
```

### 3. Emergency Buffers
**Endpoint**: `GET /emergency/buffers`

**Description**: Get buffer health and targets

**Response**:
```json
{
  "pre_tranche": {
    "current": "10000000000000",
    "target": "10000000000000",
    "utilization": 0.75,
    "health": "HEALTHY"
  },
  "irb": {
    "current": "3000000000000",
    "target": "3000000000000",
    "utilization": 0.6,
    "health": "HEALTHY"
  },
  "targets": {
    "normal": 0.03,
    "yellow": 0.05,
    "orange": 0.08,
    "red": 0.12
  },
  "health": "HEALTHY"
}
```

### 4. Risk Aggregate
**Endpoint**: `GET /risk/aggregate`

**Description**: Get aggregated risk metrics (no PII)

**Response**:
```json
{
  "tail_correlation": 0.15,
  "sovereign_utilization": 0.45,
  "buffer_health": 0.85,
  "portfolio_metrics": {
    "total_notional": "1000000000000000",
    "average_rating": "A-",
    "geographic_diversity": 0.78
  },
  "model_hash": "0xabcdef1234567890...",
  "timestamp": 1640995200
}
```

## Gateway APIs

### 5. Gateway Mint
**Endpoint**: `POST /gateway/mint`

**Description**: Mint BRICS tokens (member-gated)

**Request**:
```json
{
  "usdc_amount": "1000000000",
  "recipient": "0x1234567890abcdef...",
  "tail_corr_ppm": 150,
  "sov_util_bps": 2500
}
```

**Response**:
```json
{
  "tx_hash": "0xabcdef1234567890...",
  "tokens_out": "1000000000000000000000",
  "nav_ray": "1000000000000000000000000000",
  "timestamp": 1640995200
}
```

### 6. Gateway Redeem
**Endpoint**: `POST /gateway/redeem`

**Description**: Redeem BRICS tokens (member-gated)

**Request**:
```json
{
  "token_amount": "1000000000000000000000",
  "lane": "INSTANT"
}
```

**Response**:
```json
{
  "tx_hash": "0xabcdef1234567890...",
  "claim_id": 123,
  "usdc_amount": "1000000000",
  "source": "BUFFER",
  "timestamp": 1640995200
}
```

### 7. Claim Status
**Endpoint**: `GET /claim/{id}`

**Description**: Get claim status and details

**Response**:
```json
{
  "id": 123,
  "owner": "0x1234567890abcdef...",
  "amount": "1000000000000000000000",
  "strike_ts": 1640995200,
  "settled": false,
  "usdc_owed": "1000000000",
  "settlement_ts": null,
  "lane": "PRIMARY"
}
```

## On-Chain Contract Interfaces

### NASASAGateway
```solidity
interface INASASAGateway {
    function mint(uint256 usdcAmount, address recipient) external;
    function redeem(uint256 tokenAmount, RedemptionLane lane) external;
    function processMonthEndStrike() external;
    function settleClaim(uint256 claimId) external;
    function canInstantRedeem(address member, uint256 amount) external view returns (bool);
}
```

### ConfigRegistry
```solidity
interface IConfigRegistry {
    struct CurrentParams {
        uint256 ammMaxSlippageBps;
        uint256 redeemCapBps;
        uint256 emergencyLevel;
    }
    
    function emergencyLevel() external view returns (uint256);
    function redeemCapBps() external view returns (uint256);
    function getCurrentParams() external view returns (CurrentParams memory);
}
```

### NAVOracleV3
```solidity
interface INAVOracleV3 {
    function navRay() external view returns (uint256);
    function modelHash() external view returns (bytes32);
    function degradationLevel() external view returns (uint8);
}
```

## Emergency State Parameters

### AMM Slippage Bounds
| Emergency Level | Slippage Bound |
|----------------|----------------|
| NORMAL         | ±0.5% (500 bps) |
| YELLOW         | ±1.5% (1500 bps) |
| ORANGE         | ±2.5% (2500 bps) |
| RED            | ±5% (5000 bps) |

### IRB Targets
| Emergency Level | IRB Target |
|----------------|------------|
| NORMAL         | 3%         |
| YELLOW         | 5%         |
| ORANGE         | 8%         |
| RED            | 12%        |

### Freeze Windows
| Emergency Level | Freeze Window |
|----------------|---------------|
| NORMAL/YELLOW  | 24 hours      |
| ORANGE         | 48 hours      |
| RED            | 72 hours      |

## Error Handling

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (non-member)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Rate Limit Exceeded
- `500`: Internal Server Error
- `503`: Service Unavailable (emergency mode)

### Error Response Format
```json
{
  "error": "MEMBER_REQUIRED",
  "message": "Authentication required",
  "code": 401,
  "timestamp": 1640995200
}
```

## Rate Limiting

### Limits by Endpoint
- **Read endpoints**: 100 requests/minute
- **Write endpoints**: 10 requests/minute
- **Emergency endpoints**: 5 requests/minute

### Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995260
```

## Security Considerations

### Member Authentication
- All requests require valid member credentials
- JWT tokens with 24-hour expiration
- Refresh token mechanism for long-lived sessions

### Data Privacy
- No PII exposed in aggregate endpoints
- Member-specific data only accessible to authenticated members
- Audit logging for all data access

### Emergency Protocols
- Automatic rate limiting during emergency states
- Degraded service mode with essential endpoints only
- Emergency contact escalation procedures

## SDK Examples

### JavaScript/TypeScript
```typescript
import { BRICSClient } from '@brics-protocol/sdk';

const client = new BRICSClient({
  apiKey: process.env.BRICS_API_KEY,
  network: 'mainnet'
});

// Get current NAV
const nav = await client.getNAV();
console.log(`Current NAV: ${nav.nav}`);

// Mint tokens
const tx = await client.mint({
  usdcAmount: '1000000000',
  recipient: '0x1234567890abcdef...'
});
console.log(`Mint transaction: ${tx.tx_hash}`);
```

### Python
```python
from brics_protocol import BRICSClient

client = BRICSClient(api_key=os.getenv('BRICS_API_KEY'))

# Get emergency level
emergency = client.get_emergency_level()
print(f"Emergency level: {emergency['level']}")

# Redeem tokens
tx = client.redeem(
    token_amount='1000000000000000000000',
    lane='INSTANT'
)
print(f"Redeem transaction: {tx['tx_hash']}")
```

## Webhook Notifications

### Event Types
- `emergency.level_changed`
- `nav.updated`
- `claim.settled`
- `buffer.health_changed`

### Webhook Format
```json
{
  "event": "emergency.level_changed",
  "timestamp": 1640995200,
  "data": {
    "old_level": "NORMAL",
    "new_level": "YELLOW",
    "triggers": ["buffer_health"]
  }
}
```

## Risk FastAPI v1

### Overview
The BRICS Risk API provides aggregate-only risk feeds with deterministic Ed25519 signing for data integrity and authenticity verification. All endpoints are read-only and return signed responses to ensure data authenticity.

### Base URL
```
https://api.brics-protocol.com
```

### Authentication
- **No authentication required**: All endpoints are public
- **Signature verification**: All responses include Ed25519 signatures
- **Public key**: Available at `/.well-known/risk-api-pubkey`

### Canonical JSON Signing
All signed responses use deterministic JSON serialization:
- **Sorted keys**: All object keys are sorted alphabetically
- **No whitespace**: Compact JSON with `separators=(',', ':')`
- **Integer timestamps**: All timestamps in Unix seconds
- **Ed25519 signatures**: 64-byte signatures returned as hex strings

### Endpoints

#### Health Check
**Endpoint**: `GET /api/v1/health`

**Description**: Service health check

**Response**:
```json
{
  "status": "ok",
  "ts": 1640995200
}
```

**No signature required**

---

#### Public Key
**Endpoint**: `GET /.well-known/risk-api-pubkey`

**Description**: Get Ed25519 public key for signature verification

**Response**:
```json
{
  "ed25519_pubkey_hex": "03a107bff3ce10be1d70dd18e74bc09967e4d6309ba50d5f1ddc8664125531b8"
}
```

---

#### NAV Latest
**Endpoint**: `GET /api/v1/nav/latest`

**Description**: Get current NAV with emergency fallback

**Response**:
```json
{
  "nav_ray": 1000000000000000000000000000,
  "model_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "emergency_nav_ray": 1000000000000000000000000000,
  "emergency_enabled": 0,
  "ts": 1640995200,
  "sig": "f69c3b4a916885159b826b6442449c7e6a00b47e0d485b7b42ed99ecfe25c9c7930a71deeb99b38000a771fae51d6d1e7aa35631da6d8f893e869e459c49fb0a"
}
```

**Fields**:
- `nav_ray`: Current NAV in ray format (1e27 precision)
- `model_hash`: Hash of NAV calculation model
- `emergency_nav_ray`: Emergency NAV fallback
- `emergency_enabled`: Emergency mode (0=normal, 1=emergency)
- `ts`: Unix timestamp in seconds
- `sig`: Ed25519 signature of canonical JSON

---

#### Emergency Level
**Endpoint**: `GET /api/v1/emergency/level`

**Description**: Get current emergency state

**Response**:
```json
{
  "level": 0,
  "reason": "normal",
  "ts": 1640995200,
  "sig": "6f355255c1a4f240f72dca5d0f5cd5d4341b7a59d31657193354fdda5696fc5d477dfbd5dea5c306dd4c4aee1b102788149dede3cd6ec1eb06c7ce92aa723f0d"
}
```

**Fields**:
- `level`: Emergency level (0=GREEN, 1=AMBER, 2=RED)
- `reason`: Emergency reason description
- `ts`: Unix timestamp in seconds
- `sig`: Ed25519 signature of canonical JSON

---

#### Issuance State
**Endpoint**: `GET /api/v1/issuance/state`

**Description**: Get current issuance controller state

**Response**:
```json
{
  "locked": 0,
  "cap_tokens": 4440000000000000000000000,
  "detach_bps": 10200,
  "ratify_until": 0,
  "ts": 1640995200,
  "sig": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}
```

**Fields**:
- `locked`: Issuance locked (0=unlocked, 1=locked)
- `cap_tokens`: Current issuance cap in tokens
- `detach_bps`: Detachment level in basis points
- `ratify_until`: Ratification deadline timestamp
- `ts`: Unix timestamp in seconds
- `sig`: Ed25519 signature of canonical JSON

---

#### Risk Summary
**Endpoint**: `GET /api/v1/risk/summary`

**Description**: Get aggregate risk metrics

**Response**:
```json
{
  "defaults_bps": 300,
  "sovereign_usage_bps": 0,
  "correlation_bps": 250,
  "ts": 1640995200,
  "sig": "b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}
```

**Fields**:
- `defaults_bps`: Default risk in basis points
- `sovereign_usage_bps`: Sovereign usage in basis points
- `correlation_bps`: Correlation risk in basis points
- `ts`: Unix timestamp in seconds
- `sig`: Ed25519 signature of canonical JSON

### Signature Verification

#### Python Example
```python
import json
import requests
from nacl.signing import VerifyKey

def verify_signature(data, signature_hex, public_key_hex):
    """Verify Ed25519 signature of canonical JSON data."""
    try:
        verify_key = VerifyKey(bytes.fromhex(public_key_hex))
        
        # Create canonical JSON (sorted keys, no whitespace)
        canonical_obj = {}
        for key in sorted(data.keys()):
            value = data[key]
            if isinstance(value, float):
                canonical_obj[key] = int(value)
            else:
                canonical_obj[key] = value
        
        canonical_bytes = json.dumps(canonical_obj, separators=(',', ':'), sort_keys=True).encode('utf-8')
        
        # Verify signature
        signature_bytes = bytes.fromhex(signature_hex)
        verify_key.verify(canonical_bytes, signature_bytes)
        return True
    except Exception:
        return False

# Get public key
pubkey_response = requests.get("https://api.brics-protocol.com/.well-known/risk-api-pubkey")
public_key = pubkey_response.json()["ed25519_pubkey_hex"]

# Get NAV data
nav_response = requests.get("https://api.brics-protocol.com/api/v1/nav/latest")
nav_data = nav_response.json()

# Extract data without signature
nav_data_unsigned = {
    "nav_ray": nav_data["nav_ray"],
    "model_hash": nav_data["model_hash"],
    "emergency_nav_ray": nav_data["emergency_nav_ray"],
    "emergency_enabled": nav_data["emergency_enabled"],
    "ts": nav_data["ts"],
}

# Verify signature
is_valid = verify_signature(nav_data_unsigned, nav_data["sig"], public_key)
print(f"Signature valid: {is_valid}")
```

#### JavaScript Example
```javascript
const crypto = require('crypto');

function verifySignature(data, signatureHex, publicKeyHex) {
    try {
        // Create canonical JSON
        const canonicalObj = {};
        Object.keys(data).sort().forEach(key => {
            const value = data[key];
            canonicalObj[key] = typeof value === 'number' ? Math.floor(value) : value;
        });
        
        const canonicalJson = JSON.stringify(canonicalObj);
        const message = Buffer.from(canonicalJson, 'utf8');
        const signature = Buffer.from(signatureHex, 'hex');
        const publicKey = Buffer.from(publicKeyHex, 'hex');
        
        // Verify using Node.js crypto
        return crypto.verify(null, message, publicKey, signature);
    } catch (error) {
        return false;
    }
}

// Usage example
fetch('https://api.brics-protocol.com/api/v1/nav/latest')
    .then(response => response.json())
    .then(data => {
        const publicKey = '03a107bff3ce10be1d70dd18e74bc09967e4d6309ba50d5f1ddc8664125531b8';
        const dataWithoutSig = { ...data };
        delete dataWithoutSig.sig;
        
        const isValid = verifySignature(dataWithoutSig, data.sig, publicKey);
        console.log(`Signature valid: ${isValid}`);
    });
```

### Sample cURL Commands

#### Health Check
```bash
curl -X GET "https://api.brics-protocol.com/api/v1/health"
```

#### Get Public Key
```bash
curl -X GET "https://api.brics-protocol.com/.well-known/risk-api-pubkey"
```

#### Get NAV with Signature
```bash
curl -X GET "https://api.brics-protocol.com/api/v1/nav/latest"
```

#### Get Emergency Level
```bash
curl -X GET "https://api.brics-protocol.com/api/v1/emergency/level"
```

#### Get Issuance State
```bash
curl -X GET "https://api.brics-protocol.com/api/v1/issuance/state"
```

#### Get Risk Summary
```bash
curl -X GET "https://api.brics-protocol.com/api/v1/risk/summary"
```

### Error Responses
```json
{
  "error": "Description of the error"
}
```

**Common Errors**:
- `500`: Internal server error
- `503`: Service unavailable

### Rate Limiting
- **100 requests/minute** per IP address
- **1000 requests/hour** per IP address
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Versioning

### API Versioning
- Current version: `v1`
- Version specified in URL path
- Backward compatibility maintained for 12 months
- Deprecation notices sent 6 months in advance

### Contract Versioning
- Contract addresses published in deployment manifests
- Version tracking via contract events
- Upgrade procedures documented in governance docs
