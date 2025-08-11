#!/usr/bin/env node

/**
 * Allowlist Growth Guard
 * 
 * Prevents allowlist growth without explicit justification in PR body.
 * Compares current allowlist length to main branch baseline.
 */

const fs = require('fs');
const path = require('path');

function main() {
  const allowlistPath = 'audit/slither-allowlist.json';
  
  // Check if allowlist file exists
  if (!fs.existsSync(allowlistPath)) {
    console.log('❌ Allowlist file not found:', allowlistPath);
    process.exit(1);
  }

  // Read current allowlist
  const currentAllowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  const currentLength = currentAllowlist.length;

  // Get baseline from main branch (if available)
  const baselinePath = process.env.BASELINE_ALLOWLIST || allowlistPath;
  let baselineLength = currentLength; // Default to current if no baseline

  try {
    if (fs.existsSync(baselinePath)) {
      const baselineAllowlist = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      baselineLength = baselineAllowlist.length;
    }
  } catch (error) {
    console.log('⚠️  Could not read baseline allowlist, using current as baseline');
  }

  // Check for growth
  if (currentLength > baselineLength) {
    const growth = currentLength - baselineLength;
    
    // Check for justification in PR body
    const prBody = process.env.PR_BODY || '';
    const hasJustification = prBody.includes('JUSTIFICATION:') || 
                           prBody.includes('justification:') ||
                           prBody.includes('Justification:');

    if (!hasJustification) {
      console.log('❌ Allowlist growth detected without justification');
      console.log(`   Baseline: ${baselineLength} entries`);
      console.log(`   Current:  ${currentLength} entries`);
      console.log(`   Growth:   +${growth} entries`);
      console.log('');
      console.log('To allow growth, add "JUSTIFICATION: <explanation>" to PR body');
      console.log('Example: "JUSTIFICATION: New false positive from dependency update"');
      process.exit(1);
    } else {
      console.log('✅ Allowlist growth justified in PR body');
      console.log(`   Growth: +${growth} entries`);
    }
  } else if (currentLength < baselineLength) {
    const reduction = baselineLength - currentLength;
    console.log('✅ Allowlist reduced (good!)');
    console.log(`   Reduction: -${reduction} entries`);
  } else {
    console.log('✅ Allowlist unchanged');
  }

  console.log(`   Current length: ${currentLength} entries`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
