import { expect } from "chai";
import { ethers } from "hardhat";

describe("Invariants (Mainnet readiness)", function () {
  it("deployment addresses exist", async function () {
    // Load deployed addresses
    const addresses = JSON.parse(require('fs').readFileSync('deployment/localhost.addresses.json', 'utf8'));
    
    // Check all required addresses exist
    expect(addresses.issuance.IssuanceControllerV3).to.be.a('string');
    expect(addresses.tranche.BRICSToken).to.be.a('string');
    expect(addresses.tranche.TrancheManagerV2).to.be.a('string');
    expect(addresses.core.ConfigRegistry).to.be.a('string');
    expect(addresses.oracle.NAVOracleV3).to.be.a('string');
    expect(addresses.finance.Treasury).to.be.a('string');
    expect(addresses.finance.PreTrancheBuffer).to.be.a('string');
    expect(addresses.issuance.ClaimRegistry).to.be.a('string');
    
    // Check addresses are valid
    expect(addresses.issuance.IssuanceControllerV3).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.tranche.BRICSToken).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.tranche.TrancheManagerV2).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.core.ConfigRegistry).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.oracle.NAVOracleV3).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.finance.Treasury).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.finance.PreTrancheBuffer).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.issuance.ClaimRegistry).to.match(/^0x[a-fA-F0-9]{40}$/);
  });

  it("manifest file exists", async function () {
    // Check manifest file exists
    const manifest = JSON.parse(require('fs').readFileSync('deployment/localhost.manifest.json', 'utf8'));
    
    expect(manifest.network).to.equal('localhost');
    expect(manifest.chainId).to.equal(31337);
    expect(manifest.version).to.equal('v4.0.0');
    expect(manifest.txs).to.be.an('array');
    expect(manifest.txs.length).to.be.greaterThan(0);
  });
});
