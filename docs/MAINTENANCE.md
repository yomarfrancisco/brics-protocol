# Maintenance Guide

This document provides maintenance notes for the BRICS protocol's observability and reliability systems.

## Nightly Gas Trend Maintenance

### Job Configuration
- **Schedule**: Runs on `workflow_dispatch` and `schedule` (configurable)
- **Timeout**: 15 minutes
- **Artifacts**: CSV data, SVG chart, gas report
- **Retention**: 14 days

### Troubleshooting

**Job Fails to Generate Artifacts**
```bash
# Check locally first
yarn gas:trend && yarn gas:chart

# Verify artifact paths
ls -la dist/gas/
ls -la gas-report.txt
```

**CSV Data Quality Issues**
- Check gas report parsing in `scripts/gas/run-and-append.ts`
- Verify test suite selection (economics + bounds)
- Ensure deterministic test execution

**Chart Generation Issues**
- Check SVG generation in `scripts/gas/chart.ts`
- Verify data points and date ranges
- Check for empty datasets

### Maintenance Tasks

**Weekly**
- Review gas trend data quality
- Check for unexpected gas usage spikes
- Verify artifact retention policy

**Monthly**
- Analyze gas usage trends
- Update test suite selection if needed
- Review chart visualization improvements

## Audit Bundle Diff Maintenance

### PR Comment System
- **Trigger**: All pull requests
- **Timeout**: 10 minutes
- **Non-blocking**: Always continues on error
- **Update**: Comments updated on each push

### Troubleshooting

**Diff Report Not Generated**
```bash
# Check locally
yarn audit:bundle
ls -la dist/audit/diff.md
```

**PR Comments Not Posted**
- Verify GitHub token permissions
- Check job logs for authentication errors
- Ensure PR number is correctly parsed

**Bundle Comparison Issues**
- Verify manifest file structure
- Check bundle extraction logic
- Review diff algorithm in `scripts/audit/diff.ts`

### Maintenance Tasks

**Weekly**
- Review diff report quality
- Check for false positives/negatives
- Verify bundle comparison accuracy

**Monthly**
- Update diff heuristics if needed
- Review bundle format changes
- Optimize comparison performance

## Fixture Management

### Freshness Policy
- **Threshold**: 30 days maximum age
- **CI Check**: Automatic in unit tests
- **Manual Refresh**: `yarn fixtures:freeze`

### Troubleshooting

**Fixture Stale Error**
```bash
# Refresh fixtures
yarn fixtures:freeze && yarn fixtures:hashcheck

# Verify freshness
yarn fixtures:check
```

**Hash Verification Fails**
- Check fixture generation determinism
- Verify seed consistency
- Review hash calculation logic

### Maintenance Tasks

**Weekly**
- Check fixture freshness status
- Review fixture generation logs
- Verify hash integrity

**Monthly**
- Update fixture generation logic if needed
- Review fixture data quality
- Optimize generation performance

## CI Job Maintenance

### Required Jobs (Blocking)
- Unit & Integration Tests
- Smoke (Fresh Clone)
- Swap E2E (Replay)
- Risk API (Test)

### Optional Jobs (Non-blocking)
- Gas Report
- Audit Bundle
- Gas Nightly
- Audit Diff PR

### Troubleshooting

**Job Failures**
- Check job-specific logs
- Verify environment setup
- Review dependency caching

**Performance Issues**
- Monitor job execution times
- Optimize test suite selection
- Review caching strategies

### Maintenance Tasks

**Weekly**
- Review CI job performance
- Check for flaky tests
- Verify artifact generation

**Monthly**
- Update job configurations
- Review timeout settings
- Optimize resource usage

## Release Process Maintenance

### Artifact Generation
- **Gas Report**: `gas-report.txt`
- **Events Doc**: `docs/CONTRACT_EVENTS.md`
- **Audit Bundle**: `dist/audit/audit-bundle-*.zip`
- **Release Notes**: `dist/release-notes.md`

### Troubleshooting

**Missing Artifacts**
```bash
# Generate all artifacts
yarn audit:manifest && yarn audit:fixtures && yarn audit:tests && yarn audit:events && yarn audit:bundle
yarn release:notes
```

**Release Notes Issues**
- Check conventional commit format
- Verify changelog generation
- Review release script logic

### Maintenance Tasks

**Per Release**
- Verify all artifacts generated
- Check artifact integrity
- Review release notes accuracy

**Monthly**
- Update release automation
- Review artifact formats
- Optimize generation process

## Monitoring and Alerts

### Key Metrics
- CI job success rates
- Artifact generation success
- Fixture freshness status
- Gas trend data quality

### Alert Conditions
- CI job failures > 3 consecutive
- Missing artifacts in releases
- Fixture staleness > 25 days
- Gas trend data gaps

### Response Procedures
1. **Immediate**: Check job logs and fix root cause
2. **Short-term**: Update automation if needed
3. **Long-term**: Improve monitoring and prevention

## Future Enhancements

### Planned Improvements
- Enhanced gas trend analysis
- Automated bundle comparison
- Real-time fixture monitoring
- Advanced CI optimization

### Contributing
- Follow existing patterns
- Add appropriate tests
- Update documentation
- Maintain backward compatibility

---

For more information, see:
- [Observability Guide](OBSERVABILITY.md)
- [Release Process](RELEASE.md)
- [Contributing Guidelines](CONTRIBUTING.md)
