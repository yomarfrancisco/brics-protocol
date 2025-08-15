import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { mintHappyFixture } from "./helpers/mint-happy.fixture";
import { USDC } from "./utils/units";
import { setNavCompat, getNavRayCompat } from "./utils/nav-helpers";
import { navRayFor1to1 } from "./utils/nav-math";
import { expectedTokens, readIssuanceRateBps } from "./utils/issuance-helpers";
import { signMintIntent } from "./utils/eip712";

describe("IssuanceControllerV3 — mintForSigned", () => {
  it("happy path: valid signature mints successfully", async () => {
    const fx = await loadFixture(mintHappyFixture);
    
    // Set NAV to 1:1 conversion rate
    await fx.oracle.setEmergency(true);
    await setNavCompat(fx.oracle, navRayFor1to1);
    
    // Fund signer with USDC and approve controller
    const amt = USDC("1");
    await fx.usdc.mint(fx.ops.address, amt);
    await fx.usdc.connect(fx.ops).approve(fx.controller.target, amt);
    
    // Get network chainId and convert to BigInt
    const { chainId } = await ethers.provider.getNetwork();
    const CHAIN_ID = BigInt(chainId);
    
    // Get nonce for the caller (ops)
    const nextNonce = await fx.controller.getMintNonce(fx.ops.address);
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const deadline = now + 3600n;
    
    // Use OPS as the signer for the valid signature
    const sovereign = fx.SOVEREIGN_CODE;
    const sig = await signMintIntent(
      fx.ops,
      fx.controller.target as string,
      CHAIN_ID,
      fx.to.address,
      amt,
      0n, // tailCorrPpm
      0n, // sovUtilBps
      sovereign,
      nextNonce,
      deadline
    );
    
    // Exact math assertion
    const nav = await getNavRayCompat(fx.oracle);
    const rate = await readIssuanceRateBps(fx.cfg);
    const exp = expectedTokens(amt, nav, rate);
    
    await expect(
      fx.controller.connect(fx.ops).mintForSigned(
        fx.to.address, amt, 0, 0, sovereign, deadline, sig
      )
    ).to.emit(fx.controller, "Minted")
     .withArgs(fx.to.address, amt, exp);
    
    // Verify token balance
    expect(await fx.token.balanceOf(fx.to.address)).to.equal(exp);
  });
  
  it("fails with expired deadline", async () => {
    const fx = await loadFixture(mintHappyFixture);
    
    // Set NAV to 1:1 conversion rate
    await fx.oracle.setEmergency(true);
    await setNavCompat(fx.oracle, navRayFor1to1);
    
    // Fund signer with USDC and approve controller
    const amt = USDC("1");
    await fx.usdc.mint(fx.ops.address, amt);
    await fx.usdc.connect(fx.ops).approve(fx.controller.target, amt);
    
    // Get network chainId and convert to BigInt
    const { chainId } = await ethers.provider.getNetwork();
    const CHAIN_ID = BigInt(chainId);
    
    // Get nonce for the caller (ops) and set expired deadline
    const nextNonce = await fx.controller.getMintNonce(fx.ops.address);
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const deadline = now - 1n; // expired
    
    // Sign the mint intent
    const sovereign = fx.SOVEREIGN_CODE;
    const signature = await signMintIntent(
      fx.ops,
      fx.controller.target as string,
      CHAIN_ID,
      fx.to.address,
      amt,
      0n, // tailCorrPpm
      0n, // sovUtilBps
      sovereign,
      nextNonce,
      deadline
    );
    
    // Call mintForSigned - should fail with expired deadline
    await expect(
      fx.controller.connect(fx.ops).mintForSigned(
        fx.to.address,
        amt,
        0n, // tailCorrPpm
        0n, // sovUtilBps
        sovereign,
        deadline,
        signature
      )
    ).to.be.revertedWithCustomError(fx.controller, "ExpiredDeadline");
  });
  
  it("replay with stale nonce → InvalidSignature (signature valid but consumed)", async () => {
    const fx = await loadFixture(mintHappyFixture);
    
    // Set NAV to 1:1 conversion rate
    await fx.oracle.setEmergency(true);
    await setNavCompat(fx.oracle, navRayFor1to1);
    
    // Fund signer with USDC and approve controller
    await fx.usdc.mint(fx.ops.address, USDC("10"));
    await fx.usdc.connect(fx.ops).approve(fx.controller.target, USDC("10"));
    
    // Get network chainId and convert to BigInt
    const { chainId } = await ethers.provider.getNetwork();
    const CHAIN_ID = BigInt(chainId);
    
    // Get current nonce
    const nonce0 = await fx.controller.getMintNonce(fx.ops.address);
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const deadline = now + 3600n;
    
    const amt = USDC("1");
    
    // Sign intent with current nonce0
    const sig_stale = await signMintIntent(
      fx.ops,
      fx.controller.target as string,
      CHAIN_ID,
      fx.to.address,
      amt,
      0n,
      0n,
      fx.SOVEREIGN_CODE,
      nonce0,
      deadline
    );
    
    // Consume nonce0 with a DIFFERENT valid intent (small amount)
    const sig_consume = await signMintIntent(
      fx.ops,
      fx.controller.target as string,
      CHAIN_ID,
      fx.to.address,
      USDC("1"),
      0n,
      0n,
      fx.SOVEREIGN_CODE,
      nonce0,
      deadline
    );
    
    // This succeeds and increments nonce to nonce0+1
    await fx.controller
      .connect(fx.ops)
      .mintForSigned(fx.to.address, USDC("1"), 0, 0, fx.SOVEREIGN_CODE, deadline, sig_consume);
    
    // Replay the original (still cryptographically valid) signature with nonce0
    // The contract now expects nonce0+1, but we're passing a signature for nonce0
    // This results in InvalidSignature because the digest doesn't match the current nonce
    await expect(
      fx.controller
        .connect(fx.ops)
        .mintForSigned(fx.to.address, amt, 0, 0, fx.SOVEREIGN_CODE, deadline, sig_stale)
    ).to.be.revertedWithCustomError(fx.controller, "InvalidSignature");
  });
  
  it("fails with invalid signature (wrong signer)", async () => {
    const fx = await loadFixture(mintHappyFixture);
    
    // Set NAV to 1:1 conversion rate
    await fx.oracle.setEmergency(true);
    await setNavCompat(fx.oracle, navRayFor1to1);
    
    // Fund signer with USDC and approve controller
    const amt = USDC("1");
    await fx.usdc.mint(fx.ops.address, amt);
    await fx.usdc.connect(fx.ops).approve(fx.controller.target, amt);
    
    // Get network chainId and convert to BigInt
    const { chainId } = await ethers.provider.getNetwork();
    const CHAIN_ID = BigInt(chainId);
    
    // Get current nonce and set deadline
    const nextNonce = await fx.controller.getMintNonce(fx.ops.address);
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const deadline = now + 3600n;
    
    // Sign with a wallet that does NOT have OPS/GOV role (user)
    const sovereign = fx.SOVEREIGN_CODE;
    const sigNoRole = await signMintIntent(
      fx.to, // wrong signer - user doesn't have OPS/GOV role
      fx.controller.target as string,
      CHAIN_ID,
      fx.to.address,
      amt,
      0n, // tailCorrPpm
      0n, // sovUtilBps
      sovereign,
      nextNonce,
      deadline
    );
    
    // Call mintForSigned - should fail with invalid signature
    await expect(
      fx.controller.connect(fx.ops).mintForSigned(
        fx.to.address,
        amt,
        0n, // tailCorrPpm
        0n, // sovUtilBps
        sovereign,
        deadline,
        sigNoRole
      )
    ).to.be.revertedWithCustomError(fx.controller, "InvalidSignature");
  });
});
