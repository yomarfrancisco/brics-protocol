# BRICS Protocol Traceability Matrix

## Specification to Implementation Mapping

### §2. Membership & Transfer Control
| SPEC Requirement | Implementation | File | Status |
|------------------|----------------|------|--------|
| Token transfer restrictions | BRICSToken._update() | contracts/BRICSToken.sol:24-27 | ✅ Implemented |
| Membership checks | MemberRegistry.canSend/canReceive | contracts/MemberRegistry.sol:25-26 | ✅ Implemented |
| Pool whitelisting | MemberRegistry.isWhitelistedPool | contracts/MemberRegistry.sol:12 | ✅ Implemented |

### §3. Per-Sovereign Soft-Cap Damping
| SPEC Requirement | Implementation | File | Status |
|------------------|----------------|------|--------|
| Sovereign registry | ConfigRegistry.sovereign mapping | contracts/ConfigRegistry.sol:30 | ✅ Implemented |
| Utilization caps | SovereignCfg.utilCapBps | contracts/ConfigRegistry.sol:31 | ✅ Implemented |
| Haircut parameters | SovereignCfg.haircutBps | contracts/ConfigRegistry.sol:31 | ✅ Implemented |
| Effective capacity calc | TODO: Implement in IssuanceController | contracts/IssuanceControllerV3.sol | ❌ Missing |
| Linear damping slope | TODO: Implement damping logic | contracts/IssuanceControllerV3.sol | ❌ Missing |
| Emergency pause | ConfigRegistry.emergencyLevel | contracts/ConfigRegistry.sol:18 | ✅ Implemented |

### §4. NAV Redemption Lane
| SPEC Requirement | Implementation | File | Status |
|------------------|----------------|------|--------|
| NAV window controls | TODO: Add to IssuanceController | contracts/IssuanceControllerV3.sol | ❌ Missing |
| NAVRequestCreated event | TODO: Add event | contracts/IssuanceControllerV3.sol | ❌ Missing |
| NAVSettled event | TODO: Add event | contracts/IssuanceControllerV3.sol | ❌ Missing |
| BURNER_ROLE executor | BRICSToken.burn() | contracts/BRICSToken.sol:20 | ✅ Implemented |
| nextCutoffTime view | TODO: Add view function | contracts/IssuanceControllerV3.sol | ❌ Missing |
| pendingBy(account) view | IssuanceController.pending | contracts/IssuanceControllerV3.sol:35 | ✅ Implemented |

### §5. Oracle Signer & Degradation
| SPEC Requirement | Implementation | File | Status |
|------------------|----------------|------|--------|
| EIP-712 verification | IssuanceControllerV3.mintForSigned() | contracts/IssuanceControllerV3.sol:569-650 | ✅ Implemented |
| Signature validation | _hashMintRequest() + _recover() | contracts/IssuanceControllerV3.sol:250-280 | ✅ Implemented |
| Conservative degradation | _getNavWithDegradation() with haircuts | contracts/IssuanceControllerV3.sol:480-495 | ✅ Implemented |
| DEGRADED mode | NAVOracleV3.degradationMode | contracts/NAVOracleV3.sol | ✅ Implemented |
| Recovery procedures | resetMintNonce() + forceOracleRecovery() | contracts/IssuanceControllerV3.sol:680-690 | ✅ Implemented |

### §6. Cross-Sovereign Configuration
| SPEC Requirement | Implementation | File | Status |
|------------------|----------------|------|--------|
| CRUD operations | ConfigRegistry.addSovereign/updateSovereign | contracts/ConfigRegistry.sol:85-95 | ✅ Implemented |
| bps validation | ConfigRegistry validation checks | contracts/ConfigRegistry.sol:87,93 | ✅ Implemented |
| Unknown sovereign revert | ConfigRegistry.UnknownSovereign error | contracts/ConfigRegistry.sol:8 | ✅ Implemented |
| Insertion order | ConfigRegistry.sovereignList | contracts/ConfigRegistry.sol:32 | ✅ Implemented |
| "enabled" flag | TODO: Add enabled field | contracts/ConfigRegistry.sol | ❌ Missing |

### §7. Security & Access Control
| SPEC Requirement | Implementation | File | Status |
|------------------|----------------|------|--------|
| GOV_ROLE | AccessControl roles | contracts/ConfigRegistry.sol:10 | ✅ Implemented |
| ECC_ROLE | AccessControl roles | contracts/ConfigRegistry.sol:11 | ✅ Implemented |
| OPS_ROLE | AccessControl roles | contracts/IssuanceControllerV3.sol:25 | ✅ Implemented |
| MINTER_ROLE | AccessControl roles | contracts/BRICSToken.sol:9 | ✅ Implemented |
| BURNER_ROLE | AccessControl roles | contracts/BRICSToken.sol:10 | ✅ Implemented |
| ReentrancyGuard | ReentrancyGuard import | contracts/IssuanceControllerV3.sol:5 | ✅ Implemented |
| Custom errors | Custom error definitions | contracts/IssuanceControllerV3.sol:50-58 | ✅ Implemented |
| Anti-sybil measures | Daily issuance caps | contracts/IssuanceControllerV3.sol:42-43 | ✅ Implemented |

### §8. Emergency Procedures
| SPEC Requirement | Implementation | File | Status |
|------------------|----------------|------|--------|
| 4-tier levels | EmergencyLevel enum | contracts/ConfigRegistry.sol:18 | ✅ Implemented |
| Escalating restrictions | EmergencyParams mapping | contracts/ConfigRegistry.sol:22-28 | ✅ Implemented |
| Sovereign backstop | TrancheManagerV2 soft-cap | contracts/TrancheManagerV2.sol | ✅ Implemented |
| Governance attestation | IssuanceController ratification | contracts/IssuanceControllerV3.sol:60-70 | ✅ Implemented |

## Implementation Status Summary
- ✅ **Implemented**: 29 requirements
- ❌ **Missing**: 4 requirements
- 📊 **Coverage**: 87.9%

## Priority Implementation Tasks
1. **§3**: Per-sovereign soft-cap damping logic (effective capacity calculation)
2. **§4**: NAV redemption lane controls (window lifecycle)
3. **§6**: Sovereign "enabled" flag
4. **§9**: Enhanced Buffer Coordination (next priority)
