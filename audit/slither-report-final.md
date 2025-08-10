'npx hardhat clean' running (wd: /Users/ygorfrancisco/brics-protocol)
'npx hardhat clean --global' running (wd: /Users/ygorfrancisco/brics-protocol)
Problem executing hardhat: (node:97772) ExperimentalWarning: CommonJS module /Users/ygorfrancisco/.nvm/versions/node/v23.3.0/lib/node_modules/npm/node_modules/debug/src/node.js is loading ES Module /Users/ygorfrancisco/.nvm/versions/node/v23.3.0/lib/node_modules/npm/node_modules/supports-color/index.js using require().
Support for loading ES Module in require() is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
WARNING: You are currently using Node.js v23.3.0, which is not supported by Hardhat. This can lead to unexpected behavior. See https://hardhat.org/nodejs-versions

'npx hardhat compile --force' running (wd: /Users/ygorfrancisco/brics-protocol)
INFO:Detectors:
Math.mulDiv(uint256,uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#204-275) has bitwise-xor operator ^ instead of the exponentiation operator **: 
	 - inverse = (3 * denominator) ^ 2 (node_modules/@openzeppelin/contracts/utils/math/Math.sol#257)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#incorrect-exponentiation
INFO:Detectors:
Math.mulDiv(uint256,uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#204-275) performs a multiplication on the result of a division:
	- denominator = denominator / twos (node_modules/@openzeppelin/contracts/utils/math/Math.sol#242)
	- inverse = (3 * denominator) ^ 2 (node_modules/@openzeppelin/contracts/utils/math/Math.sol#257)
Math.mulDiv(uint256,uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#204-275) performs a multiplication on the result of a division:
	- denominator = denominator / twos (node_modules/@openzeppelin/contracts/utils/math/Math.sol#242)
	- inverse *= 2 - denominator * inverse (node_modules/@openzeppelin/contracts/utils/math/Math.sol#261)
Math.mulDiv(uint256,uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#204-275) performs a multiplication on the result of a division:
	- denominator = denominator / twos (node_modules/@openzeppelin/contracts/utils/math/Math.sol#242)
	- inverse *= 2 - denominator * inverse (node_modules/@openzeppelin/contracts/utils/math/Math.sol#262)
Math.mulDiv(uint256,uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#204-275) performs a multiplication on the result of a division:
	- denominator = denominator / twos (node_modules/@openzeppelin/contracts/utils/math/Math.sol#242)
	- inverse *= 2 - denominator * inverse (node_modules/@openzeppelin/contracts/utils/math/Math.sol#263)
Math.mulDiv(uint256,uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#204-275) performs a multiplication on the result of a division:
	- denominator = denominator / twos (node_modules/@openzeppelin/contracts/utils/math/Math.sol#242)
	- inverse *= 2 - denominator * inverse (node_modules/@openzeppelin/contracts/utils/math/Math.sol#264)
Math.mulDiv(uint256,uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#204-275) performs a multiplication on the result of a division:
	- denominator = denominator / twos (node_modules/@openzeppelin/contracts/utils/math/Math.sol#242)
	- inverse *= 2 - denominator * inverse (node_modules/@openzeppelin/contracts/utils/math/Math.sol#265)
Math.mulDiv(uint256,uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#204-275) performs a multiplication on the result of a division:
	- denominator = denominator / twos (node_modules/@openzeppelin/contracts/utils/math/Math.sol#242)
	- inverse *= 2 - denominator * inverse (node_modules/@openzeppelin/contracts/utils/math/Math.sol#266)
Math.mulDiv(uint256,uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#204-275) performs a multiplication on the result of a division:
	- low = low / twos (node_modules/@openzeppelin/contracts/utils/math/Math.sol#245)
	- result = low * inverse (node_modules/@openzeppelin/contracts/utils/math/Math.sol#272)
Math.invMod(uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#315-361) performs a multiplication on the result of a division:
	- quotient = gcd / remainder (node_modules/@openzeppelin/contracts/utils/math/Math.sol#337)
	- (gcd,remainder) = (remainder,gcd - remainder * quotient) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#339-346)
IssuanceControllerV3._calculateEffectiveCapacity(bytes32,uint256) (contracts/IssuanceControllerV3.sol#635-667) performs a multiplication on the result of a division:
	- dampedCapBps = baseEffectiveCap * (10000 - dampingFactor) / 10000 (contracts/IssuanceControllerV3.sol#663)
	- effectiveCap = (softCap * dampedCapBps) / 10000 (contracts/IssuanceControllerV3.sol#664)
IssuanceControllerV3.canIssue(uint256,uint256,uint256,bytes32) (contracts/IssuanceControllerV3.sol#669-705) performs a multiplication on the result of a division:
	- tokensOut = (usdcAmt * 1e27) / nav (contracts/IssuanceControllerV3.sol#691)
	- adjustedTokensOut = (tokensOut * params.maxIssuanceRateBps) / 10000 (contracts/IssuanceControllerV3.sol#692)
IssuanceControllerV3.mintForSigned(address,uint256,uint256,uint256,bytes32,uint256,bytes) (contracts/IssuanceControllerV3.sol#708-801) performs a multiplication on the result of a division:
	- out = (usdcAmt * 1e27) / nav (contracts/IssuanceControllerV3.sol#755)
	- out = (out * params.maxIssuanceRateBps) / 10000 (contracts/IssuanceControllerV3.sol#759)
IssuanceControllerV3.mintFor(address,uint256,uint256,uint256,bytes32) (contracts/IssuanceControllerV3.sol#804-876) performs a multiplication on the result of a division:
	- out = (usdcAmt * 1e27) / nav (contracts/IssuanceControllerV3.sol#829)
	- out = (out * params.maxIssuanceRateBps) / 10000 (contracts/IssuanceControllerV3.sol#833)
NAVOracleV3._degradedBase() (contracts/NAVOracleV3.sol#222-237) performs a multiplication on the result of a division:
	- hoursElapsed = (block.timestamp - lastKnownGoodTs) / 3600 (contracts/NAVOracleV3.sol#225)
	- growth = (lastKnownGoodNav * maxDailyGrowthBps * hoursElapsed) / (10000 * 24) (contracts/NAVOracleV3.sol#227)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#divide-before-multiply
INFO:Detectors:
Reentrancy in IssuanceControllerV3.mintClaimsForWindow(address[]) (contracts/IssuanceControllerV3.sol#460-497):
	External calls:
	- claimId = _mintClaimForUser(u,w.id,amt) (contracts/IssuanceControllerV3.sol#475)
		- claimId = claims.mintClaim(to,0,amount) (contracts/IssuanceControllerV3.sol#612)
	State variables written after the call(s):
	- pendingBy[u] = 0 (contracts/IssuanceControllerV3.sol#478)
	IssuanceControllerV3.pendingBy (contracts/IssuanceControllerV3.sol#108) can be used in cross function reentrancies:
	- IssuanceControllerV3.mintClaimsForWindow(address[]) (contracts/IssuanceControllerV3.sol#460-497)
	- IssuanceControllerV3.pendingBy (contracts/IssuanceControllerV3.sol#108)
	- IssuanceControllerV3.pendingOf(address) (contracts/IssuanceControllerV3.sol#363-365)
Reentrancy in IssuanceControllerV3.settleClaim(uint256,uint256,address) (contracts/IssuanceControllerV3.sol#515-568):
	External calls:
	- treasury.pay(holder,payAmt) (contracts/IssuanceControllerV3.sol#547)
	- _settleAndBurnClaim(claimId,holder) (contracts/IssuanceControllerV3.sol#553)
		- claims.settleAndBurn(claimId,holder) (contracts/IssuanceControllerV3.sol#622)
	State variables written after the call(s):
	- w.state = NavWindowState.SETTLED_FULL (contracts/IssuanceControllerV3.sol#561)
	IssuanceControllerV3.navWindows (contracts/IssuanceControllerV3.sol#107) can be used in cross function reentrancies:
	- IssuanceControllerV3.closeNavWindow() (contracts/IssuanceControllerV3.sol#394-401)
	- IssuanceControllerV3.currentNavWindow() (contracts/IssuanceControllerV3.sol#351-353)
	- IssuanceControllerV3.getWindowSummary(uint256) (contracts/IssuanceControllerV3.sol#304-326)
	- IssuanceControllerV3.mintClaimsForWindow(address[]) (contracts/IssuanceControllerV3.sol#460-497)
	- IssuanceControllerV3.navWindows (contracts/IssuanceControllerV3.sol#107)
	- IssuanceControllerV3.nextCutoffTime() (contracts/IssuanceControllerV3.sol#355-361)
	- IssuanceControllerV3.openNavWindow(uint256) (contracts/IssuanceControllerV3.sol#376-392)
	- IssuanceControllerV3.strikeRedemption() (contracts/IssuanceControllerV3.sol#500-512)
	- w.state = NavWindowState.SETTLED_PARTIAL (contracts/IssuanceControllerV3.sol#564)
	IssuanceControllerV3.navWindows (contracts/IssuanceControllerV3.sol#107) can be used in cross function reentrancies:
	- IssuanceControllerV3.closeNavWindow() (contracts/IssuanceControllerV3.sol#394-401)
	- IssuanceControllerV3.currentNavWindow() (contracts/IssuanceControllerV3.sol#351-353)
	- IssuanceControllerV3.getWindowSummary(uint256) (contracts/IssuanceControllerV3.sol#304-326)
	- IssuanceControllerV3.mintClaimsForWindow(address[]) (contracts/IssuanceControllerV3.sol#460-497)
	- IssuanceControllerV3.navWindows (contracts/IssuanceControllerV3.sol#107)
	- IssuanceControllerV3.nextCutoffTime() (contracts/IssuanceControllerV3.sol#355-361)
	- IssuanceControllerV3.openNavWindow(uint256) (contracts/IssuanceControllerV3.sol#376-392)
	- IssuanceControllerV3.strikeRedemption() (contracts/IssuanceControllerV3.sol#500-512)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-1
INFO:Detectors:
IssuanceControllerV3.mintClaimsForWindow(address[]).count (contracts/IssuanceControllerV3.sol#467) is a local variable never initialized
NAVOracleV3.setNAV(uint256,uint256,uint256,bytes[]).valid (contracts/NAVOracleV3.sol#263) is a local variable never initialized
IssuanceControllerV3.mintClaimsForWindow(address[]).totalTokens (contracts/IssuanceControllerV3.sol#466) is a local variable never initialized
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#uninitialized-local-variables
INFO:Detectors:
IssuanceControllerV3._liquidityOk() (contracts/IssuanceControllerV3.sol#586-600) ignores return value by (None,None,irbTarget,None,None) = treasury.getLiquidityStatus() (contracts/IssuanceControllerV3.sol#587)
IssuanceControllerV3._liquidityOk() (contracts/IssuanceControllerV3.sol#586-600) ignores return value by (current,target,None,None) = preBuffer.getBufferStatus() (contracts/IssuanceControllerV3.sol#595)
IssuanceControllerV3._getClaimInfo(uint256) (contracts/IssuanceControllerV3.sol#617-619) ignores return value by (owner,amount,None,settled) = claims.claimInfo(claimId) (contracts/IssuanceControllerV3.sol#618)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unused-return
INFO:Detectors:
IssuanceControllerV3._calculateEffectiveCapacity(bytes32,uint256).canIssue (contracts/IssuanceControllerV3.sol#635) shadows:
	- IssuanceControllerV3.canIssue(uint256,uint256,uint256,bytes32) (contracts/IssuanceControllerV3.sol#669-705) (function)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#local-variable-shadowing
INFO:Detectors:
MemberRegistry.setRegistrar(address).r (contracts/MemberRegistry.sol#26) lacks a zero-check on :
		- registrar = r (contracts/MemberRegistry.sol#27)
TrancheManagerV2.constructor(address,address,address).oracle_ (contracts/TrancheManagerV2.sol#70) lacks a zero-check on :
		- oracle = oracle_ (contracts/TrancheManagerV2.sol#73)
TrancheManagerV2.constructor(address,address,address).config_ (contracts/TrancheManagerV2.sol#70) lacks a zero-check on :
		- config = config_ (contracts/TrancheManagerV2.sol#74)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#missing-zero-address-validation
INFO:Detectors:
IssuanceControllerV3._mintClaimForUser(address,uint256,uint256) (contracts/IssuanceControllerV3.sol#611-615) has external calls inside a loop: claimId = claims.mintClaim(to,0,amount) (contracts/IssuanceControllerV3.sol#612)
	Calls stack containing the loop:
		IssuanceControllerV3.mintClaimsForWindow(address[])
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation/#calls-inside-a-loop
INFO:Detectors:
Reentrancy in IssuanceControllerV3._mintClaimForUser(address,uint256,uint256) (contracts/IssuanceControllerV3.sol#611-615):
	External calls:
	- claimId = claims.mintClaim(to,0,amount) (contracts/IssuanceControllerV3.sol#612)
	State variables written after the call(s):
	- claimToWindow[claimId] = windowId (contracts/IssuanceControllerV3.sol#613)
Reentrancy in IssuanceControllerV3.mintClaimsForWindow(address[]) (contracts/IssuanceControllerV3.sol#460-497):
	External calls:
	- claimId = _mintClaimForUser(u,w.id,amt) (contracts/IssuanceControllerV3.sol#475)
		- claimId = claims.mintClaim(to,0,amount) (contracts/IssuanceControllerV3.sol#612)
	State variables written after the call(s):
	- claimToWindow[claimId] = w.id (contracts/IssuanceControllerV3.sol#482)
Reentrancy in IssuanceControllerV3.requestRedeemOnBehalf(address,uint256) (contracts/IssuanceControllerV3.sol#404-457):
	External calls:
	- token.burn(user,amt) (contracts/IssuanceControllerV3.sol#428)
	- preBuffer.instantRedeem(user,usdcOut) (contracts/IssuanceControllerV3.sol#431)
	State variables written after the call(s):
	- totalIssued -= amt (contracts/IssuanceControllerV3.sol#435)
Reentrancy in IssuanceControllerV3.settleClaim(uint256,uint256,address) (contracts/IssuanceControllerV3.sol#515-568):
	External calls:
	- treasury.pay(holder,payAmt) (contracts/IssuanceControllerV3.sol#547)
	State variables written after the call(s):
	- reservedForNav -= amountTokens (contracts/IssuanceControllerV3.sol#552)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-2
INFO:Detectors:
Reentrancy in OperationalAgreement.approveMember(address) (contracts/OperationalAgreement.sol#47-50):
	External calls:
	- registry.setMember(user,true) (contracts/OperationalAgreement.sol#49)
	Event emitted after the call(s):
	- MemberApproved(user) (contracts/OperationalAgreement.sol#49)
Reentrancy in RedemptionClaim.mintClaim(address,uint256,uint256) (contracts/RedemptionClaim.sol#50-62):
	External calls:
	- _mint(to,id,1,) (contracts/RedemptionClaim.sol#59)
		- response = IERC1155Receiver(to).onERC1155Received(operator,from,id,value,data) (node_modules/@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol#34-48)
		- response = IERC1155Receiver(to).onERC1155BatchReceived(operator,from,ids,values,data) (node_modules/@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol#69-85)
		- ERC1155Utils.checkOnERC1155Received(operator,from,to,id,value,data) (node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#194)
		- ERC1155Utils.checkOnERC1155BatchReceived(operator,from,to,ids,values,data) (node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#196)
	Event emitted after the call(s):
	- ClaimMinted(id,to,amount,strikeTs) (contracts/RedemptionClaim.sol#60)
Reentrancy in IssuanceControllerV3.mintClaimsForWindow(address[]) (contracts/IssuanceControllerV3.sol#460-497):
	External calls:
	- claimId = _mintClaimForUser(u,w.id,amt) (contracts/IssuanceControllerV3.sol#475)
		- claimId = claims.mintClaim(to,0,amount) (contracts/IssuanceControllerV3.sol#612)
	Event emitted after the call(s):
	- NAVClaimsMinted(w.id,count,totalTokens) (contracts/IssuanceControllerV3.sol#496)
Reentrancy in IssuanceControllerV3.revertToRatified() (contracts/IssuanceControllerV3.sol#995-998):
	External calls:
	- tm.setIssuanceLocked(true) (contracts/IssuanceControllerV3.sol#996)
	Event emitted after the call(s):
	- DetachmentReverted(ratifiedLo,ratifiedHi) (contracts/IssuanceControllerV3.sol#997)
Reentrancy in OperationalAgreement.revokeMember(address) (contracts/OperationalAgreement.sol#52-55):
	External calls:
	- registry.setMember(user,false) (contracts/OperationalAgreement.sol#54)
	Event emitted after the call(s):
	- MemberRevoked(user) (contracts/OperationalAgreement.sol#54)
Reentrancy in RedemptionClaim.settleAndBurn(uint256,address) (contracts/RedemptionClaim.sol#71-78):
	External calls:
	- _burn(holder,id,1) (contracts/RedemptionClaim.sol#76)
		- response = IERC1155Receiver(to).onERC1155Received(operator,from,id,value,data) (node_modules/@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol#34-48)
		- response = IERC1155Receiver(to).onERC1155BatchReceived(operator,from,ids,values,data) (node_modules/@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol#69-85)
		- ERC1155Utils.checkOnERC1155Received(operator,from,to,id,value,data) (node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#194)
		- ERC1155Utils.checkOnERC1155BatchReceived(operator,from,to,ids,values,data) (node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#196)
	Event emitted after the call(s):
	- ClaimSettled(id,holder) (contracts/RedemptionClaim.sol#77)
Reentrancy in OperationalAgreement.whitelistPool(address,bool) (contracts/OperationalAgreement.sol#57-60):
	External calls:
	- registry.setPool(pool,ok) (contracts/OperationalAgreement.sol#59)
	Event emitted after the call(s):
	- PoolWhitelisted(pool,ok) (contracts/OperationalAgreement.sol#59)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-3
INFO:Detectors:
ClaimRegistry.getClaim(uint256) (contracts/ClaimRegistry.sol#215-218) uses timestamp for comparisons
	Dangerous comparisons:
	- ! claims[claimId].isActive && ! claims[claimId].isSettled (contracts/ClaimRegistry.sol#216)
IssuanceControllerV3.openNavWindow(uint256) (contracts/IssuanceControllerV3.sol#376-392) uses timestamp for comparisons
	Dangerous comparisons:
	- closeTs <= block.timestamp + 3600 || closeTs <= block.timestamp + windowMinDuration (contracts/IssuanceControllerV3.sol#378)
IssuanceControllerV3.closeNavWindow() (contracts/IssuanceControllerV3.sol#394-401) uses timestamp for comparisons
	Dangerous comparisons:
	- block.timestamp < w.closeTs (contracts/IssuanceControllerV3.sol#397)
IssuanceControllerV3.requestRedeemOnBehalf(address,uint256) (contracts/IssuanceControllerV3.sol#404-457) uses timestamp for comparisons
	Dangerous comparisons:
	- block.timestamp - lastRedeemReq[user] < cooldown (contracts/IssuanceControllerV3.sol#412)
IssuanceControllerV3.settleClaim(uint256,uint256,address) (contracts/IssuanceControllerV3.sol#515-568) uses timestamp for comparisons
	Dangerous comparisons:
	- block.timestamp < w.strikeTs + SETTLEMENT_DELAY (contracts/IssuanceControllerV3.sol#520)
IssuanceControllerV3.mintForSigned(address,uint256,uint256,uint256,bytes32,uint256,bytes) (contracts/IssuanceControllerV3.sol#708-801) uses timestamp for comparisons
	Dangerous comparisons:
	- block.timestamp > deadline (contracts/IssuanceControllerV3.sol#724)
	- lastIssueDay[msg.sender] != today (contracts/IssuanceControllerV3.sol#777)
IssuanceControllerV3.mintFor(address,uint256,uint256,uint256,bytes32) (contracts/IssuanceControllerV3.sol#804-876) uses timestamp for comparisons
	Dangerous comparisons:
	- lastIssueDay[msg.sender] != today (contracts/IssuanceControllerV3.sol#852)
IssuanceControllerV3.executeMintNonceReset() (contracts/IssuanceControllerV3.sol#938-945) uses timestamp for comparisons
	Dangerous comparisons:
	- require(bool,string)(recoveryRequests[msg.sender] > 0,No reset requested) (contracts/IssuanceControllerV3.sol#939)
	- require(bool,string)(block.timestamp >= recoveryRequests[msg.sender],Timelock not expired) (contracts/IssuanceControllerV3.sol#940)
IssuanceControllerV3.extendRatificationDeadline() (contracts/IssuanceControllerV3.sol#970-980) uses timestamp for comparisons
	Dangerous comparisons:
	- require(bool,string)(timeElapsed >= RATIFY_DEADLINE && timeElapsed < RATIFY_DEADLINE + 86400,wrong timing) (contracts/IssuanceControllerV3.sol#976)
IssuanceControllerV3.maybeRevertDetachment() (contracts/IssuanceControllerV3.sol#982-993) uses timestamp for comparisons
	Dangerous comparisons:
	- block.timestamp > deadline (contracts/IssuanceControllerV3.sol#990)
MezzanineVault.withdraw(uint256,address,address) (contracts/MezzanineVault.sol#51-54) uses timestamp for comparisons
	Dangerous comparisons:
	- require(bool,string)(block.timestamp > reinvestUntil || ! principalLocked,reinvest lock) (contracts/MezzanineVault.sol#52)
MezzanineVault.redeem(uint256,address,address) (contracts/MezzanineVault.sol#56-59) uses timestamp for comparisons
	Dangerous comparisons:
	- require(bool,string)(block.timestamp > reinvestUntil || ! principalLocked,reinvest lock) (contracts/MezzanineVault.sol#57)
NAVOracleV3.navRay() (contracts/NAVOracleV3.sol#103-109) uses timestamp for comparisons
	Dangerous comparisons:
	- degradationMode || _isStale() (contracts/NAVOracleV3.sol#104)
	- d <= 0 (contracts/NAVOracleV3.sol#106)
NAVOracleV3.getDegradationLevel() (contracts/NAVOracleV3.sol#117-131) uses timestamp for comparisons
	Dangerous comparisons:
	- timeSinceLastUpdate >= t3After (contracts/NAVOracleV3.sol#122)
	- timeSinceLastUpdate >= t2After (contracts/NAVOracleV3.sol#124)
	- timeSinceLastUpdate >= t1After (contracts/NAVOracleV3.sol#126)
NAVOracleV3._isStale() (contracts/NAVOracleV3.sol#217-219) uses timestamp for comparisons
	Dangerous comparisons:
	- block.timestamp > _lastTs + staleThreshold (contracts/NAVOracleV3.sol#218)
NAVOracleV3._degradedBase() (contracts/NAVOracleV3.sol#222-237) uses timestamp for comparisons
	Dangerous comparisons:
	- base < floor_ (contracts/NAVOracleV3.sol#233)
	- base > ceil_ (contracts/NAVOracleV3.sol#234)
NAVOracleV3._haircut(uint256) (contracts/NAVOracleV3.sol#240-247) uses timestamp for comparisons
	Dangerous comparisons:
	- age >= t3After (contracts/NAVOracleV3.sol#242-245)
	- age >= t2After (contracts/NAVOracleV3.sol#242-245)
	- age >= t1After (contracts/NAVOracleV3.sol#242-245)
NAVOracleV3.emergencySetNAV(uint256,uint256,bytes) (contracts/NAVOracleV3.sol#284-301) uses timestamp for comparisons
	Dangerous comparisons:
	- require(bool,string)(degradationMode || _isStale(),not in degradation) (contracts/NAVOracleV3.sol#285)
PreTrancheBuffer.availableInstantCapacity(address) (contracts/PreTrancheBuffer.sol#79-94) uses timestamp for comparisons
	Dangerous comparisons:
	- lastRedemptionDay[user] != today (contracts/PreTrancheBuffer.sol#86)
PreTrancheBuffer.instantRedeem(address,uint256) (contracts/PreTrancheBuffer.sol#104-124) uses timestamp for comparisons
	Dangerous comparisons:
	- lastRedemptionDay[user] != today (contracts/PreTrancheBuffer.sol#115)
RedemptionClaim.safeTransferFrom(address,address,uint256,uint256,bytes) (contracts/RedemptionClaim.sol#85-101) uses timestamp for comparisons
	Dangerous comparisons:
	- require(bool,string)(block.timestamp + effectiveFreezeSecs < c.strikeTs,claim frozen pre-strike) (contracts/RedemptionClaim.sol#99)
TrancheManagerV2.getEffectiveDetachment() (contracts/TrancheManagerV2.sol#112-130) uses timestamp for comparisons
	Dangerous comparisons:
	- level == 3 && expansionTier == 2 && tier2Expiry != 0 && block.timestamp <= tier2Expiry (contracts/TrancheManagerV2.sol#116-119)
	- softCapExpiry != 0 && block.timestamp <= softCapExpiry (contracts/TrancheManagerV2.sol#125)
TrancheManagerV2.raiseBRICSDetachment(uint16,uint16) (contracts/TrancheManagerV2.sol#132-154) uses timestamp for comparisons
	Dangerous comparisons:
	- block.timestamp - lastDetachmentUpdateTs < DETACHMENT_COOLDOWN (contracts/TrancheManagerV2.sol#143)
	- last + ORACLE_STALE_TOL < block.timestamp (contracts/TrancheManagerV2.sol#146)
TrancheManagerV2.enforceSoftCapExpiry(uint16) (contracts/TrancheManagerV2.sol#171-179) uses timestamp for comparisons
	Dangerous comparisons:
	- softCapExpiry == 0 (contracts/TrancheManagerV2.sol#172)
	- block.timestamp <= softCapExpiry (contracts/TrancheManagerV2.sol#173)
TrancheManagerV2.enforceTier2Expiry(uint16) (contracts/TrancheManagerV2.sol#213-223) uses timestamp for comparisons
	Dangerous comparisons:
	- tier2Expiry == 0 (contracts/TrancheManagerV2.sol#214)
	- block.timestamp <= tier2Expiry (contracts/TrancheManagerV2.sol#215)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#block-timestamp
INFO:Detectors:
ERC1155._asSingletonArrays(uint256,uint256) (node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#368-388) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#372-387)
ERC1155Utils.checkOnERC1155Received(address,address,address,uint256,uint256,bytes) (node_modules/@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol#25-50) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol#44-46)
ERC1155Utils.checkOnERC1155BatchReceived(address,address,address,uint256[],uint256[],bytes) (node_modules/@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol#60-87) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol#81-83)
SafeERC20._callOptionalReturn(IERC20,bytes) (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#173-191) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#176-186)
SafeERC20._callOptionalReturnBool(IERC20,bytes) (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#201-211) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#205-209)
ERC721Utils.checkOnERC721Received(address,address,address,uint256,bytes) (node_modules/@openzeppelin/contracts/token/ERC721/utils/ERC721Utils.sol#25-49) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/token/ERC721/utils/ERC721Utils.sol#43-45)
Arrays._begin(uint256[]) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#142-146) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#143-145)
Arrays._mload(uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#161-165) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#162-164)
Arrays._swap(uint256,uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#170-177) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#171-176)
Arrays._castToUint256Array(address[]) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#180-184) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#181-183)
Arrays._castToUint256Array(bytes32[]) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#187-191) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#188-190)
Arrays._castToUint256Comp(function(address,address) returns(bool)) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#194-200) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#197-199)
Arrays._castToUint256Comp(function(bytes32,bytes32) returns(bool)) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#203-209) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#206-208)
Arrays.unsafeAccess(address[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#383-389) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#385-387)
Arrays.unsafeAccess(bytes32[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#396-402) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#398-400)
Arrays.unsafeAccess(uint256[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#409-415) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#411-413)
Arrays.unsafeAccess(bytes[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#422-428) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#424-426)
Arrays.unsafeAccess(string[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#435-441) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#437-439)
Arrays.unsafeMemoryAccess(address[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#448-452) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#449-451)
Arrays.unsafeMemoryAccess(bytes32[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#459-463) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#460-462)
Arrays.unsafeMemoryAccess(uint256[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#470-474) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#471-473)
Arrays.unsafeMemoryAccess(bytes[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#481-485) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#482-484)
Arrays.unsafeMemoryAccess(string[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#492-496) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#493-495)
Arrays.unsafeSetLength(address[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#503-507) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#504-506)
Arrays.unsafeSetLength(bytes32[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#514-518) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#515-517)
Arrays.unsafeSetLength(uint256[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#525-529) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#526-528)
Arrays.unsafeSetLength(bytes[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#536-540) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#537-539)
Arrays.unsafeSetLength(string[],uint256) (node_modules/@openzeppelin/contracts/utils/Arrays.sol#547-551) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Arrays.sol#548-550)
Panic.panic(uint256) (node_modules/@openzeppelin/contracts/utils/Panic.sol#50-56) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Panic.sol#51-55)
SlotDerivation.erc7201Slot(string) (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#45-50) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#46-49)
SlotDerivation.deriveArray(bytes32) (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#64-69) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#65-68)
SlotDerivation.deriveMapping(bytes32,address) (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#74-80) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#75-79)
SlotDerivation.deriveMapping(bytes32,bool) (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#85-91) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#86-90)
SlotDerivation.deriveMapping(bytes32,bytes32) (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#96-102) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#97-101)
SlotDerivation.deriveMapping(bytes32,uint256) (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#107-113) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#108-112)
SlotDerivation.deriveMapping(bytes32,int256) (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#118-124) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#119-123)
SlotDerivation.deriveMapping(bytes32,string) (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#129-139) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#130-138)
SlotDerivation.deriveMapping(bytes32,bytes) (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#144-154) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#145-153)
StorageSlot.getAddressSlot(bytes32) (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#66-70) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#67-69)
StorageSlot.getBooleanSlot(bytes32) (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#75-79) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#76-78)
StorageSlot.getBytes32Slot(bytes32) (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#84-88) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#85-87)
StorageSlot.getUint256Slot(bytes32) (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#93-97) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#94-96)
StorageSlot.getInt256Slot(bytes32) (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#102-106) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#103-105)
StorageSlot.getStringSlot(bytes32) (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#111-115) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#112-114)
StorageSlot.getStringSlot(string) (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#120-124) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#121-123)
StorageSlot.getBytesSlot(bytes32) (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#129-133) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#130-132)
StorageSlot.getBytesSlot(bytes) (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#138-142) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#139-141)
Strings.toString(uint256) (node_modules/@openzeppelin/contracts/utils/Strings.sol#45-63) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Strings.sol#50-52)
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Strings.sol#55-57)
Strings.toChecksumHexString(address) (node_modules/@openzeppelin/contracts/utils/Strings.sol#111-129) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Strings.sol#116-118)
Strings.escapeJSON(string) (node_modules/@openzeppelin/contracts/utils/Strings.sol#446-476) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Strings.sol#470-473)
Strings._unsafeReadBytesOffset(bytes,uint256) (node_modules/@openzeppelin/contracts/utils/Strings.sol#484-489) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/Strings.sol#486-488)
Math.add512(uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#25-30) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/math/Math.sol#26-29)
Math.mul512(uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#37-46) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/math/Math.sol#41-45)
Math.tryMul(uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#73-84) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/math/Math.sol#76-80)
Math.tryDiv(uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#89-97) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/math/Math.sol#92-95)
Math.tryMod(uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#102-110) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/math/Math.sol#105-108)
Math.mulDiv(uint256,uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#204-275) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/math/Math.sol#227-234)
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/math/Math.sol#240-249)
Math.tryModExp(uint256,uint256,uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#409-433) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/math/Math.sol#411-432)
Math.tryModExp(bytes,bytes,bytes) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#449-471) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/math/Math.sol#461-470)
Math.log2(uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#612-651) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/math/Math.sol#648-650)
SafeCast.toUint(bool) (node_modules/@openzeppelin/contracts/utils/math/SafeCast.sol#1157-1161) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/utils/math/SafeCast.sol#1158-1160)
IssuanceControllerV3._recover(bytes32,bytes) (contracts/IssuanceControllerV3.sol#270-280) uses assembly
	- INLINE ASM (contracts/IssuanceControllerV3.sol#273-277)
NAVOracleV3._recover(bytes32,bytes) (contracts/NAVOracleV3.sol#303-313) uses assembly
	- INLINE ASM (contracts/NAVOracleV3.sol#306-310)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#assembly-usage
INFO:Detectors:
6 different versions of Solidity are used:
	- Version constraint ^0.8.20 is used by:
		-^0.8.20 (node_modules/@openzeppelin/contracts/access/AccessControl.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC721/utils/ERC721Utils.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/Arrays.sol#5)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/Comparators.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/Context.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/Panic.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/Pausable.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#5)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#5)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/Strings.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/introspection/ERC165.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/math/Math.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/math/SafeCast.sol#5)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/math/SignedMath.sol#4)
	- Version constraint >=0.8.4 is used by:
		->=0.8.4 (node_modules/@openzeppelin/contracts/access/IAccessControl.sol#4)
		->=0.8.4 (node_modules/@openzeppelin/contracts/interfaces/draft-IERC6093.sol#3)
	- Version constraint >=0.6.2 is used by:
		->=0.6.2 (node_modules/@openzeppelin/contracts/interfaces/IERC1363.sol#4)
		->=0.6.2 (node_modules/@openzeppelin/contracts/interfaces/IERC4626.sol#4)
		->=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC1155/IERC1155.sol#4)
		->=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol#4)
		->=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol#4)
		->=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol#4)
		->=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC721/IERC721.sol#4)
		->=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol#4)
	- Version constraint >=0.4.16 is used by:
		->=0.4.16 (node_modules/@openzeppelin/contracts/interfaces/IERC165.sol#4)
		->=0.4.16 (node_modules/@openzeppelin/contracts/interfaces/IERC20.sol#4)
		->=0.4.16 (node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#4)
		->=0.4.16 (node_modules/@openzeppelin/contracts/utils/introspection/IERC165.sol#4)
	- Version constraint >=0.5.0 is used by:
		->=0.5.0 (node_modules/@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol#4)
	- Version constraint ^0.8.24 is used by:
		-^0.8.24 (contracts/BRICSToken.sol#2)
		-^0.8.24 (contracts/ClaimRegistry.sol#2)
		-^0.8.24 (contracts/ConfigRegistry.sol#2)
		-^0.8.24 (contracts/IssuanceControllerV3.sol#2)
		-^0.8.24 (contracts/MemberRegistry.sol#2)
		-^0.8.24 (contracts/MezzanineVault.sol#2)
		-^0.8.24 (contracts/NAVOracleV3.sol#2)
		-^0.8.24 (contracts/OperationalAgreement.sol#2)
		-^0.8.24 (contracts/PreTrancheBuffer.sol#2)
		-^0.8.24 (contracts/RedemptionClaim.sol#2)
		-^0.8.24 (contracts/SovereignClaimToken.sol#2)
		-^0.8.24 (contracts/TrancheManagerV2.sol#2)
		-^0.8.24 (contracts/Treasury.sol#2)
		-^0.8.24 (contracts/mocks/MockNAVOracle.sol#2)
		-^0.8.24 (contracts/mocks/MockUSDC.sol#2)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#different-pragma-directives-are-used
INFO:Detectors:
IssuanceControllerV3.mintForSigned(address,uint256,uint256,uint256,bytes32,uint256,bytes) (contracts/IssuanceControllerV3.sol#708-801) has a high cyclomatic complexity (17).
IssuanceControllerV3.mintFor(address,uint256,uint256,uint256,bytes32) (contracts/IssuanceControllerV3.sol#804-876) has a high cyclomatic complexity (15).
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#cyclomatic-complexity
INFO:Detectors:
Version constraint ^0.8.20 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- VerbatimInvalidDeduplication
	- FullInlinerNonExpressionSplitArgumentEvaluationOrder
	- MissingSideEffectsOnSelectorAccess.
It is used by:
	- ^0.8.20 (node_modules/@openzeppelin/contracts/access/AccessControl.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC1155/utils/ERC1155Utils.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC721/ERC721.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC721/utils/ERC721Utils.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/Arrays.sol#5)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/Comparators.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/Context.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/Panic.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/Pausable.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/SlotDerivation.sol#5)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/StorageSlot.sol#5)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/Strings.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/introspection/ERC165.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/math/Math.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/math/SafeCast.sol#5)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/math/SignedMath.sol#4)
Version constraint >=0.8.4 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- FullInlinerNonExpressionSplitArgumentEvaluationOrder
	- MissingSideEffectsOnSelectorAccess
	- AbiReencodingHeadOverflowWithStaticArrayCleanup
	- DirtyBytesArrayToStorage
	- DataLocationChangeInInternalOverride
	- NestedCalldataArrayAbiReencodingSizeValidation
	- SignedImmutables.
It is used by:
	- >=0.8.4 (node_modules/@openzeppelin/contracts/access/IAccessControl.sol#4)
	- >=0.8.4 (node_modules/@openzeppelin/contracts/interfaces/draft-IERC6093.sol#3)
Version constraint >=0.6.2 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- MissingSideEffectsOnSelectorAccess
	- AbiReencodingHeadOverflowWithStaticArrayCleanup
	- DirtyBytesArrayToStorage
	- NestedCalldataArrayAbiReencodingSizeValidation
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching
	- EmptyByteArrayCopy
	- DynamicArrayCleanup
	- MissingEscapingInFormatting
	- ArraySliceDynamicallyEncodedBaseType
	- ImplicitConstructorCallvalueCheck
	- TupleAssignmentMultiStackSlotComponents
	- MemoryArrayCreationOverflow.
It is used by:
	- >=0.6.2 (node_modules/@openzeppelin/contracts/interfaces/IERC1363.sol#4)
	- >=0.6.2 (node_modules/@openzeppelin/contracts/interfaces/IERC4626.sol#4)
	- >=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC1155/IERC1155.sol#4)
	- >=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol#4)
	- >=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol#4)
	- >=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol#4)
	- >=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC721/IERC721.sol#4)
	- >=0.6.2 (node_modules/@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol#4)
Version constraint >=0.4.16 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- DirtyBytesArrayToStorage
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching
	- EmptyByteArrayCopy
	- DynamicArrayCleanup
	- ImplicitConstructorCallvalueCheck
	- TupleAssignmentMultiStackSlotComponents
	- MemoryArrayCreationOverflow
	- privateCanBeOverridden
	- SignedArrayStorageCopy
	- ABIEncoderV2StorageArrayWithMultiSlotElement
	- DynamicConstructorArgumentsClippedABIV2
	- UninitializedFunctionPointerInConstructor_0.4.x
	- IncorrectEventSignatureInLibraries_0.4.x
	- ExpExponentCleanup
	- NestedArrayFunctionCallDecoder
	- ZeroFunctionSelector.
It is used by:
	- >=0.4.16 (node_modules/@openzeppelin/contracts/interfaces/IERC165.sol#4)
	- >=0.4.16 (node_modules/@openzeppelin/contracts/interfaces/IERC20.sol#4)
	- >=0.4.16 (node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#4)
	- >=0.4.16 (node_modules/@openzeppelin/contracts/utils/introspection/IERC165.sol#4)
Version constraint >=0.5.0 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- DirtyBytesArrayToStorage
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching
	- EmptyByteArrayCopy
	- DynamicArrayCleanup
	- ImplicitConstructorCallvalueCheck
	- TupleAssignmentMultiStackSlotComponents
	- MemoryArrayCreationOverflow
	- privateCanBeOverridden
	- SignedArrayStorageCopy
	- ABIEncoderV2StorageArrayWithMultiSlotElement
	- DynamicConstructorArgumentsClippedABIV2
	- UninitializedFunctionPointerInConstructor
	- IncorrectEventSignatureInLibraries
	- ABIEncoderV2PackedStorage.
It is used by:
	- >=0.5.0 (node_modules/@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol#4)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#incorrect-versions-of-solidity
INFO:Detectors:
Low level call in ERC4626._tryGetAssetDecimals(IERC20) (node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol#86-97):
	- (success,encodedDecimals) = address(asset_).staticcall(abi.encodeCall(IERC20Metadata.decimals,())) (node_modules/@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol#87-89)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#low-level-calls
INFO:Detectors:
Variable IssuanceControllerV3._DOMAIN_SEPARATOR (contracts/IssuanceControllerV3.sol#50) is not in mixedCase
Variable NAVOracleV3._DOMAIN_SEPARATOR (contracts/NAVOracleV3.sol#32) is not in mixedCase
Parameter TrancheManagerV2.setClaimRegistry(address)._claimRegistry (contracts/TrancheManagerV2.sol#77) is not in mixedCase
Parameter MockNAVOracle.setNAV(uint256)._navRay (contracts/mocks/MockNAVOracle.sol#18) is not in mixedCase
Parameter MockNAVOracle.setDegradationMode(bool)._degradationMode (contracts/mocks/MockNAVOracle.sol#23) is not in mixedCase
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#conformance-to-solidity-naming-conventions
INFO:Detectors:
Math.log2(uint256) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#612-651) uses literals with too many digits:
	- r = r | byte(uint256,uint256)(x >> r,0x0000010102020202030303030303030300000000000000000000000000000000) (node_modules/@openzeppelin/contracts/utils/math/Math.sol#649)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#too-many-digits
INFO:Detectors:
Loop condition i < sovereignList.length (contracts/ConfigRegistry.sol#167) should use cached array length instead of referencing `length` member of the storage array.
 Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#cache-array-length
INFO:Detectors:
IssuanceControllerV3.windowMinDuration (contracts/IssuanceControllerV3.sol#111) should be constant 
RedemptionClaim.freezeSecs (contracts/RedemptionClaim.sol#30) should be constant 
TrancheManagerV2.supermajorityThreshold (contracts/TrancheManagerV2.sol#45) should be constant 
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#state-variables-that-could-be-declared-constant
INFO:Detectors:
IssuanceControllerV3._DOMAIN_SEPARATOR (contracts/IssuanceControllerV3.sol#50) should be immutable 
IssuanceControllerV3._cachedChainId (contracts/IssuanceControllerV3.sol#51) should be immutable 
IssuanceControllerV3.cfg (contracts/IssuanceControllerV3.sol#56) should be immutable 
IssuanceControllerV3.claimRegistry (contracts/IssuanceControllerV3.sol#62) should be immutable 
IssuanceControllerV3.claims (contracts/IssuanceControllerV3.sol#60) should be immutable 
IssuanceControllerV3.nextStrike (contracts/IssuanceControllerV3.sol#65) should be immutable 
IssuanceControllerV3.oracle (contracts/IssuanceControllerV3.sol#57) should be immutable 
IssuanceControllerV3.preBuffer (contracts/IssuanceControllerV3.sol#61) should be immutable 
IssuanceControllerV3.tm (contracts/IssuanceControllerV3.sol#55) should be immutable 
IssuanceControllerV3.token (contracts/IssuanceControllerV3.sol#54) should be immutable 
IssuanceControllerV3.treasury (contracts/IssuanceControllerV3.sol#59) should be immutable 
IssuanceControllerV3.usdc (contracts/IssuanceControllerV3.sol#58) should be immutable 
MezzanineVault.principalLocked (contracts/MezzanineVault.sol#19) should be immutable 
MezzanineVault.reinvestUntil (contracts/MezzanineVault.sol#18) should be immutable 
NAVOracleV3._DOMAIN_SEPARATOR (contracts/NAVOracleV3.sol#32) should be immutable 
NAVOracleV3._cachedChainId (contracts/NAVOracleV3.sol#33) should be immutable 
OperationalAgreement.registry (contracts/OperationalAgreement.sol#15) should be immutable 
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#state-variables-that-could-be-declared-immutable
INFO:Slither:. analyzed (53 contracts with 100 detectors), 163 result(s) found
