# Sovereign Operations Playbook

## Overview
This document provides operational procedures for managing sovereign claims through the SovereignClaimSBT contract. It covers the complete lifecycle from claim filing to settlement, including evidence management and compliance requirements.

## Roles and Responsibilities

### GOV_ROLE (Protocol Governance)
- **Primary**: Claim filing, closure, and governance oversight
- **Secondary**: Emergency operations and evidence management
- **Key Functions**: `fileClaim()`, `close()`, `setHashes()`, `setEvidenceURI()`, `burn()`

### SOV_ROLE (Sovereign Operations)
- **Primary**: Day-to-day claim processing and settlement
- **Secondary**: Payment tracking and reimbursement management
- **Key Functions**: `acknowledge()`, `markPaidToSPV()`, `markReimbursed()`

### ECC_ROLE (Emergency Credit Committee)
- **Primary**: Emergency claim filing and crisis management
- **Secondary**: Expedited processing during emergencies
- **Key Functions**: `fileClaim()` (emergency scenarios)

## Claim Lifecycle Procedures

### Phase 1: Claim Filing

#### Pre-Filing Checklist
- [ ] Legal team prepares ISDA annex documentation
- [ ] Evidence pack compiled (PDFs, DocuSign records, etc.)
- [ ] RedemptionQueue claimId identified and verified
- [ ] USDC notional amount calculated and verified
- [ ] Governance approval obtained (if required)

#### Filing Process
1. **Document Preparation**:
```bash
   # Generate hashes for off-chain documents
   isda_hash=$(sha256sum isda_annex.pdf | cut -d' ' -f1)
   docs_hash=$(sha256sum evidence_pack.zip | cut -d' ' -f1)
   ```

2. **On-Chain Filing**:
   ```solidity
   // GOV_ROLE or ECC_ROLE calls fileClaim
   uint256 tokenId = sbt.fileClaim(
       claimant_address,
       redemptionId,
       usdcNotional,
       isda_hash,
       docs_hash,
       "ipfs://evidence-metadata"
   );
   ```

3. **Post-Filing Verification**:
   - Verify token minted successfully
   - Confirm all data fields correct
   - Store tokenId for tracking

#### Typical Timeline: 1-3 business days

### Phase 2: Claim Acknowledgment

#### Acknowledgment Process
1. **Sovereign Review**:
   - Legal team reviews claim validity
   - Compliance checks completed
   - Internal approval obtained

2. **On-Chain Acknowledgment**:
   ```solidity
   // SOV_ROLE calls acknowledge
   sbt.acknowledge(tokenId);
   ```

3. **Post-Acknowledgment**:
   - Update internal tracking systems
   - Notify relevant stakeholders
   - Begin payment processing

#### Typical Timeline: 5-10 business days

### Phase 3: Payment to SPV

#### Payment Process
1. **Payment Execution**:
   - Execute USDC transfer to Special Purpose Vehicle
   - Obtain payment confirmation
   - Record payment details

2. **On-Chain Recording**:
   ```solidity
   // SOV_ROLE calls markPaidToSPV
   sbt.markPaidToSPV(tokenId, usdcPaidAmount);
   ```

3. **Post-Payment**:
   - Verify payment recorded correctly
   - Update financial records
   - Begin reimbursement process

#### Typical Timeline: 1-2 business days

### Phase 4: Sovereign Reimbursement

#### Reimbursement Process
1. **Reimbursement Execution**:
   - Process sovereign reimbursement to SPV
   - Verify reimbursement amount
   - Obtain confirmation

2. **On-Chain Recording**:
   ```solidity
   // SOV_ROLE or GOV_ROLE calls markReimbursed
   sbt.markReimbursed(tokenId, usdcReimbursedAmount);
   ```

3. **Post-Reimbursement**:
   - Verify reimbursement recorded
   - Update financial records
   - Prepare for claim closure

#### Typical Timeline: 1-3 business days

### Phase 5: Claim Closure

#### Closure Process
1. **Final Review**:
   - Verify all payments completed
   - Confirm all documentation in order
   - Obtain final approval

2. **On-Chain Closure**:
   ```solidity
   // GOV_ROLE calls close
   sbt.close(tokenId);
   ```

3. **Post-Closure**:
   - Update internal systems
   - Archive claim records
   - Optional: Burn SBT for cleanup

#### Typical Timeline: 1 business day

## Evidence Management

### Evidence Pack Composition

#### Required Documents
- **ISDA Annex**: Signed ISDA annex/amendment
- **Legal Opinions**: Relevant legal opinions
- **Payment Confirmations**: Bank transfer confirmations
- **Compliance Certificates**: Regulatory compliance documents
- **Audit Reports**: Relevant audit findings

#### Document Standards
- **Format**: PDF for all documents
- **Naming**: Consistent naming convention
- **Versioning**: Clear version control
- **Accessibility**: Secure but accessible storage

### Hash Management

#### Hash Generation
```bash
#!/bin/bash
# Generate hashes for evidence pack
echo "Generating document hashes..."

# ISDA annex hash
isda_hash=$(sha256sum "isda_annex_v1.2.pdf" | cut -d' ' -f1)
echo "ISDA Hash: $isda_hash"

# Evidence pack hash
tar -czf evidence_pack.tar.gz evidence_documents/
docs_hash=$(sha256sum "evidence_pack.tar.gz" | cut -d' ' -f1)
echo "Docs Hash: $docs_hash"

# Store hashes securely
echo "$isda_hash" > .isda_hash
echo "$docs_hash" > .docs_hash
```

#### Hash Verification
```bash
#!/bin/bash
# Verify document integrity
echo "Verifying document integrity..."

# Verify ISDA annex
current_isda_hash=$(sha256sum "isda_annex_v1.2.pdf" | cut -d' ' -f1)
stored_isda_hash=$(cat .isda_hash)

if [ "$current_isda_hash" = "$stored_isda_hash" ]; then
    echo "✓ ISDA annex integrity verified"
else
    echo "✗ ISDA annex integrity check failed"
    exit 1
fi

# Verify evidence pack
current_docs_hash=$(sha256sum "evidence_pack.tar.gz" | cut -d' ' -f1)
stored_docs_hash=$(cat .docs_hash)

if [ "$current_docs_hash" = "$stored_docs_hash" ]; then
    echo "✓ Evidence pack integrity verified"
else
    echo "✗ Evidence pack integrity check failed"
    exit 1
fi
```

### Metadata Management

#### IPFS Integration
```bash
#!/bin/bash
# Upload evidence metadata to IPFS
echo "Uploading evidence metadata to IPFS..."

# Create metadata JSON
cat > metadata.json << EOF
{
  "claim_id": "$tokenId",
  "redemption_id": "$redemptionId",
  "filed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "documents": {
    "isda_annex": "isda_annex_v1.2.pdf",
    "evidence_pack": "evidence_pack.tar.gz"
  },
  "hashes": {
    "isda_annex": "$isda_hash",
    "evidence_pack": "$docs_hash"
  }
}
EOF

# Upload to IPFS
ipfs_hash=$(ipfs add -q metadata.json)
echo "IPFS Hash: $ipfs_hash"

# Update evidence URI
sbt.setEvidenceURI(tokenId, "ipfs://$ipfs_hash")
```

## Emergency Procedures

### Emergency Claim Filing

#### Crisis Response
1. **Immediate Assessment**:
   - Evaluate crisis severity
   - Determine if emergency filing required
   - Activate emergency response team

2. **Expedited Filing**:
   ```solidity
   // ECC_ROLE can file claims during emergencies
   uint256 tokenId = sbt.fileClaim(
       claimant_address,
       redemptionId,
       usdcNotional,
       emergency_isda_hash,
       emergency_docs_hash,
       "emergency://evidence"
   );
   ```

3. **Post-Emergency Review**:
   - Complete full documentation
   - Update hashes with final documents
   - Regularize claim status

### Pause/Unpause Procedures

#### Emergency Pause
```solidity
// GOV_ROLE can pause all operations
sbt.pause();
```

#### Pause Recovery
```solidity
// GOV_ROLE can unpause operations
sbt.unpause();
```

## Compliance and Reporting

### Regulatory Reporting

#### Status Reports
- **Daily**: Active claim status
- **Weekly**: Processing metrics
- **Monthly**: Settlement summaries
- **Quarterly**: Compliance reviews

#### Audit Trail
- **On-Chain**: All transactions recorded
- **Off-Chain**: Document hashes anchored
- **Timeline**: Complete lifecycle tracking
- **Access**: Role-based access control

### Documentation Requirements

#### Legal Compliance
- **ISDA Compliance**: All ISDA requirements met
- **PFMA Compliance**: PFMA framework followed
- **Regulatory Reporting**: Required reports submitted
- **Audit Readiness**: Audit trail maintained

#### Record Keeping
- **Retention**: 7+ years for all records
- **Accessibility**: Secure but accessible storage
- **Integrity**: Hash-verified document integrity
- **Backup**: Multiple secure backups

## Monitoring and Alerts

### Key Metrics

#### Processing Metrics
- **Average Processing Time**: Target < 15 business days
- **Success Rate**: Target > 99%
- **Error Rate**: Target < 1%
- **Compliance Score**: Target 100%

#### Financial Metrics
- **Total Claims**: Running total of filed claims
- **Total Settled**: Running total of closed claims
- **Average Amount**: Average claim size
- **Processing Volume**: Claims per time period

### Alert Thresholds

#### Performance Alerts
- **Processing Time**: > 20 business days
- **Error Rate**: > 2%
- **Compliance Score**: < 95%
- **System Downtime**: > 1 hour

#### Financial Alerts
- **Large Claims**: > $10M USDC
- **Unusual Volume**: > 2x average daily volume
- **Payment Delays**: > 3 business days
- **Reimbursement Issues**: > 5 business days

## Troubleshooting

### Common Issues

#### Status Progression Errors
**Error**: `SBT_ONLY_FORWARD`
**Cause**: Attempting to move status backward
**Solution**: Ensure proper status sequence

#### Role Permission Errors
**Error**: `SBT_ONLY_ROLE`
**Cause**: Insufficient role permissions
**Solution**: Verify caller has required role

#### Pause State Errors
**Error**: `SBT_PAUSED`
**Cause**: Contract is paused
**Solution**: Wait for unpause or contact GOV_ROLE

### Recovery Procedures

#### Status Correction
1. **Identify Issue**: Determine incorrect status
2. **Assess Impact**: Evaluate operational impact
3. **Plan Correction**: Develop correction plan
4. **Execute Fix**: Implement correction
5. **Verify Result**: Confirm status corrected

#### Emergency Recovery
1. **Assess Situation**: Evaluate emergency severity
2. **Activate Procedures**: Follow emergency protocols
3. **Execute Recovery**: Implement recovery plan
4. **Monitor Progress**: Track recovery progress
5. **Document Lessons**: Record lessons learned

## Training and Certification

### Role Training

#### GOV_ROLE Training
- **Contract Functions**: All governance functions
- **Emergency Procedures**: Crisis response protocols
- **Compliance Requirements**: Regulatory obligations
- **Risk Management**: Risk assessment and mitigation

#### SOV_ROLE Training
- **Daily Operations**: Routine claim processing
- **Payment Procedures**: Payment and reimbursement
- **Documentation**: Evidence management
- **Compliance**: Operational compliance

#### ECC_ROLE Training
- **Emergency Response**: Crisis management
- **Expedited Processing**: Emergency procedures
- **Risk Assessment**: Emergency risk evaluation
- **Communication**: Emergency communication protocols

### Certification Requirements

#### Initial Certification
- **Role-Specific Training**: Complete role training
- **Practical Assessment**: Demonstrate proficiency
- **Compliance Review**: Pass compliance review
- **System Access**: Obtain system access

#### Ongoing Certification
- **Annual Review**: Annual proficiency review
- **Compliance Updates**: Stay current with regulations
- **System Updates**: Learn new system features
- **Best Practices**: Stay current with best practices

## Contact Information

### Emergency Contacts
- **GOV_ROLE**: governance@brics-protocol.com
- **SOV_ROLE**: sovereign-ops@brics-protocol.com
- **ECC_ROLE**: emergency@brics-protocol.com

### Support Channels
- **Technical Support**: tech-support@brics-protocol.com
- **Compliance Support**: compliance@brics-protocol.com
- **Legal Support**: legal@brics-protocol.com

### Escalation Procedures
1. **Level 1**: Direct role contact
2. **Level 2**: Role supervisor
3. **Level 3**: Emergency committee
4. **Level 4**: Executive leadership
