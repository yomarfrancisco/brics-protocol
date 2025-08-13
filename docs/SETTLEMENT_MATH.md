# Settlement Math (Draft v0.1)

**Status:** Draft (parity-targeted)  
**Scope:** Back-to-back CDS swap settlement for BRICS protocol

## 1. Notation & Units

- `fairSpreadBps` — fair spread in basis points (bps), integer [1..10000]
- `fixedSpreadBps` — contractual fixed spread in bps, integer [1..10000]
- `notional` — face value in token's smallest unit (e.g., 6-dec USDC → 1 USDC = 1e6)
- `elapsedDays` — integer trading days elapsed since swap start
- `tenorDays` — integer total tenor days
- `tokenDecimals` — settlement token decimals (USDC=6, DAI/BRICS=18, etc.)

Let:
- `Δbps = fairSpreadBps - fixedSpreadBps` (can be negative)
- `S = 10_000` (bps per 1.00)

## 2. Canonical Formula (annualized on a day-count basis)

We settle the mark-to-market over the elapsed fraction of tenor:

\[
\text{pnlTokens} \;=\; \frac{\Delta bps}{S}\; \times \; \text{notionalTokens} \; \times \; \frac{\text{elapsedDays}}{\text{tenorDays}}
\]

Where:
- `notionalTokens = notional / (10^tokenDecimals)`  
- Sign convention: **positive PnL means seller pays buyer**, negative means buyer pays seller.

On-chain we compute in **smallest units** with integer math and round **half-up** to the token's smallest unit.

## 3. Integer Implementation (smallest units)

pnlSmallestUnits =
round_half_up(
Δbps * notional * elapsedDays,
denominator = S * tenorDays
)

### 3.1 Rounding
- **Round-half-up**: add `denominator/2` to a non-negative numerator before integer division; subtract `denominator/2` for negative numerators.
- Result fits in `int256` if inputs are bounded per constraints below.

## 4. Bounds & Validation

- `1 ≤ fixedSpreadBps, fairSpreadBps ≤ 10_000`
- `1 ≤ elapsedDays ≤ tenorDays`
- `1 ≤ tenorDays ≤ 36500` (100y safety cap)
- `0 < notional`
- `tokenDecimals ∈ [0..18]`

## 5. Transfer Semantics

- If `pnlSmallestUnits > 0`: **seller → buyer** transfer of `pnlSmallestUnits`.
- If `< 0`: **buyer → seller** transfer of `abs(pnlSmallestUnits)`.
- Settlement respects **mode**:
  - `ACCOUNTING` (default): emit events / internal accounting only.
  - `TRANSFERS`: perform ERC20 transfers via SafeERC20.

## 6. Events

### SettlementExecuted Event
```solidity
event SettlementExecuted(
    bytes32 indexed swapId,
    address indexed buyer,
    address indexed seller,
    int256 pnlSmallest,
    uint256 asOf,
    uint32 elapsedDays,
    uint32 tenorDays
);
```

This event is emitted when a swap is settled, providing detailed information about:
- **swapId**: Unique identifier for the settled swap
- **buyer**: Address of the protection buyer
- **seller**: Address of the protection seller  
- **pnlSmallest**: PnL in smallest units (can be negative)
- **asOf**: Timestamp when settlement was executed
- **elapsedDays**: Number of days elapsed since swap start
- **tenorDays**: Total tenor days of the swap

## 7. Security Features

- **SafeERC20**: All token transfers use SafeERC20 to prevent common ERC20 issues
- **Pausable**: Contract can be paused by governance in emergency situations
- **ReentrancyGuard**: Prevents reentrancy attacks during settlement
- **Role-based Access**: Only authorized roles can perform settlement operations
- **Bounds Validation**: All inputs are validated against defined bounds
- **Signature Verification**: Quote signatures are verified using ECDSA

## 8. Determinism & Parity

- Off-chain (Python) and on-chain (Solidity) must produce identical `pnlSmallestUnits` for the same inputs.
- Golden vectors in `pricing_service/tests/golden/settlement_vectors.json`.
- Tolerance: **exact match** (integer).

## 9. Examples

For `fair=800`, `fixed=80`, `notional=1_000_000` (USDC 1e6), `elapsedDays=15`, `tenorDays=30`:

Δbps = 720
numerator = 720 * 1_000_000 * 15 = 10_800_000_000
denominator = 10_000 * 30 = 300_000
pnl = round_half_up(10_800_000_000 / 300_000) = round_half_up(36_000) = 36_000 (smallest units)

= **0.036000 USDC**, seller pays buyer.
