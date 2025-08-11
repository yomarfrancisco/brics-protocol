# Slither High Severity Findings

This report contains only high severity findings that need immediate attention.

## 1. divide-before-multiply - _degradedBase

**Severity:** Medium
**Contract:** _degradedBase
**Function:** _degradedBase
**Source:** contracts/NAVOracleV3.sol:222

**Description:** NAVOracleV3._degradedBase() (contracts/NAVOracleV3.sol#222-237) performs a multiplication on the result of a division:
	- hoursElapsed = (block.timestamp - lastKnownGoodTs) / 3600 (contracts/NAVOracleV3.sol#225)
	- growth = (lastKnownGoodNav * maxDailyGrowthBps * hoursElapsed) / (10000 * 24) (contracts/NAVOracleV3.sol#227)


**Code Snippet:**
```solidity
hoursElapsed = (block.timestamp - lastKnownGoodTs) / 3600
```

```solidity
growth = (lastKnownGoodNav * maxDailyGrowthBps * hoursElapsed) / (10000 * 24)
```

**Risk Summary:** NAVOracleV3._degradedBase() (contracts/NAVOracleV3.sol#222-237) performs a multiplication on the result of a division:
	- hoursElapsed = (block.timestamp - lastKnownGoodTs) / 3600 (contracts/NAVOracleV3.sol#225)
	- growth = (lastKnownGoodNav * maxDailyGrowthBps * hoursElapsed) / (10000 * 24) (contracts/NAVOracleV3.sol#227)


---

## 2. divide-before-multiply - mintForSigned

**Severity:** Medium
**Contract:** mintForSigned
**Function:** mintForSigned
**Source:** contracts/IssuanceControllerV3.sol:708

**Description:** IssuanceControllerV3.mintForSigned(address,uint256,uint256,uint256,bytes32,uint256,bytes) (contracts/IssuanceControllerV3.sol#708-801) performs a multiplication on the result of a division:
	- out = (usdcAmt * 1e27) / nav (contracts/IssuanceControllerV3.sol#755)
	- out = (out * params.maxIssuanceRateBps) / 10000 (contracts/IssuanceControllerV3.sol#759)


**Code Snippet:**
```solidity
out = (usdcAmt * 1e27) / nav
```

```solidity
out = (out * params.maxIssuanceRateBps) / 10000
```

**Risk Summary:** IssuanceControllerV3.mintForSigned(address,uint256,uint256,uint256,bytes32,uint256,bytes) (contracts/IssuanceControllerV3.sol#708-801) performs a multiplication on the result of a division:
	- out = (usdcAmt * 1e27) / nav (contracts/IssuanceControllerV3.sol#755)
	- out = (out * params.maxIssuanceRateBps) / 10000 (contracts/IssuanceControllerV3.sol#759)


---

## 3. divide-before-multiply - mintFor

**Severity:** Medium
**Contract:** mintFor
**Function:** mintFor
**Source:** contracts/IssuanceControllerV3.sol:804

**Description:** IssuanceControllerV3.mintFor(address,uint256,uint256,uint256,bytes32) (contracts/IssuanceControllerV3.sol#804-876) performs a multiplication on the result of a division:
	- out = (usdcAmt * 1e27) / nav (contracts/IssuanceControllerV3.sol#829)
	- out = (out * params.maxIssuanceRateBps) / 10000 (contracts/IssuanceControllerV3.sol#833)


**Code Snippet:**
```solidity
out = (usdcAmt * 1e27) / nav
```

```solidity
out = (out * params.maxIssuanceRateBps) / 10000
```

**Risk Summary:** IssuanceControllerV3.mintFor(address,uint256,uint256,uint256,bytes32) (contracts/IssuanceControllerV3.sol#804-876) performs a multiplication on the result of a division:
	- out = (usdcAmt * 1e27) / nav (contracts/IssuanceControllerV3.sol#829)
	- out = (out * params.maxIssuanceRateBps) / 10000 (contracts/IssuanceControllerV3.sol#833)


---

## 4. divide-before-multiply - canIssue

**Severity:** Medium
**Contract:** canIssue
**Function:** canIssue
**Source:** contracts/IssuanceControllerV3.sol:669

**Description:** IssuanceControllerV3.canIssue(uint256,uint256,uint256,bytes32) (contracts/IssuanceControllerV3.sol#669-705) performs a multiplication on the result of a division:
	- tokensOut = (usdcAmt * 1e27) / nav (contracts/IssuanceControllerV3.sol#691)
	- adjustedTokensOut = (tokensOut * params.maxIssuanceRateBps) / 10000 (contracts/IssuanceControllerV3.sol#692)


**Code Snippet:**
```solidity
tokensOut = (usdcAmt * 1e27) / nav
```

```solidity
adjustedTokensOut = (tokensOut * params.maxIssuanceRateBps) / 10000
```

**Risk Summary:** IssuanceControllerV3.canIssue(uint256,uint256,uint256,bytes32) (contracts/IssuanceControllerV3.sol#669-705) performs a multiplication on the result of a division:
	- tokensOut = (usdcAmt * 1e27) / nav (contracts/IssuanceControllerV3.sol#691)
	- adjustedTokensOut = (tokensOut * params.maxIssuanceRateBps) / 10000 (contracts/IssuanceControllerV3.sol#692)


---

## 5. divide-before-multiply - _calculateEffectiveCapacity

**Severity:** Medium
**Contract:** _calculateEffectiveCapacity
**Function:** _calculateEffectiveCapacity
**Source:** contracts/IssuanceControllerV3.sol:635

**Description:** IssuanceControllerV3._calculateEffectiveCapacity(bytes32,uint256) (contracts/IssuanceControllerV3.sol#635-667) performs a multiplication on the result of a division:
	- dampedCapBps = baseEffectiveCap * (10000 - dampingFactor) / 10000 (contracts/IssuanceControllerV3.sol#663)
	- effectiveCap = (softCap * dampedCapBps) / 10000 (contracts/IssuanceControllerV3.sol#664)


**Code Snippet:**
```solidity
dampedCapBps = baseEffectiveCap * (10000 - dampingFactor) / 10000
```

```solidity
effectiveCap = (softCap * dampedCapBps) / 10000
```

**Risk Summary:** IssuanceControllerV3._calculateEffectiveCapacity(bytes32,uint256) (contracts/IssuanceControllerV3.sol#635-667) performs a multiplication on the result of a division:
	- dampedCapBps = baseEffectiveCap * (10000 - dampingFactor) / 10000 (contracts/IssuanceControllerV3.sol#663)
	- effectiveCap = (softCap * dampedCapBps) / 10000 (contracts/IssuanceControllerV3.sol#664)


---

