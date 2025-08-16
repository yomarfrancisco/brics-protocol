import { expect } from "chai";
import { ethers } from "hardhat";

describe("Invariants (Mainnet readiness)", function () {
  it("deployment addresses exist", async function () {
    // Skip this test in CI environment where deployment files may not exist
    if (process.env.CI) {
      this.skip();
      return;
    }

    // Load deployed addresses
    const addresses = JSON.parse(require('fs').readFileSync('deployment/localhost.addresses.json', 'utf8'));
    
    // Check all required addresses exist (flat structure)
    expect(addresses.IssuanceControllerV3).to.be.a('string');
    expect(addresses.BRICSToken).to.be.a('string');
    expect(addresses.TrancheManagerV2).to.be.a('string');
    expect(addresses.ConfigRegistry).to.be.a('string');
    expect(addresses.NAVOracleV3).to.be.a('string');
    expect(addresses.Treasury).to.be.a('string');
    expect(addresses.PreTrancheBuffer).to.be.a('string');
    expect(addresses.ClaimRegistry).to.be.a('string');
    
    // Check addresses are valid
    expect(addresses.IssuanceControllerV3).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.BRICSToken).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.TrancheManagerV2).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.ConfigRegistry).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.NAVOracleV3).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.Treasury).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.PreTrancheBuffer).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(addresses.ClaimRegistry).to.match(/^0x[a-fA-F0-9]{40}$/);
  });

  it("manifest file exists", async function () {
    // Skip this test in CI environment where deployment files may not exist
    if (process.env.CI) {
      this.skip();
      return;
    }

    // Check manifest file exists
    const manifest = JSON.parse(require('fs').readFileSync('deployment/localhost.manifest.json', 'utf8'));
    
    expect(manifest.network).to.equal('localhost');
    expect(manifest.chainId).to.equal(31337);
    expect(manifest.version).to.equal('v4.0.0');
    expect(manifest.txs).to.be.an('array');
    expect(manifest.txs.length).to.be.greaterThan(0);
  });
});
