// test/issue61.happy.spec.ts
import { expect } from "chai";
import { mintHappyFixture } from "./helpers/mint-happy.fixture";
import { getNavRayCompat, setNavCompat } from "./utils/nav-helpers";
import { navRayFor1to1, BRICS_DEC, USDC } from "./utils/nav-math";
import { expectedTokens, readIssuanceRateBps } from "./utils/issuance-helpers";

describe("IssuanceControllerV3 — mintFor happy path", () => {
  it("mints successfully once preconditions are satisfied", async () => {
    const { controller, ops, to, SOVEREIGN_CODE, token, memberRegistry, oracle, cfg } = await mintHappyFixture();
    
    // Debug: Check if controller has MINTER_ROLE
    const MINTER_ROLE = await token.MINTER_ROLE();
    const hasMinterRole = await token.hasRole(MINTER_ROLE, await controller.getAddress());
    console.log("Controller has MINTER_ROLE:", hasMinterRole);
    
    // Debug: Check oracle state
    const debugNav = await getNavRayCompat(oracle);
    console.log("NAV:", debugNav.toString());
    
    // Debug: Check sovereign capacity (can't call internal function directly)
    console.log("SOVEREIGN_CODE:", SOVEREIGN_CODE);
    
    // Debug: Check member registry
    const canReceive = await memberRegistry.canReceive(to.address);
    console.log("Recipient canReceive:", canReceive);
    
    // Debug: Check config state
    const params = await cfg.getCurrentParams();
    console.log("Emergency level:", params.emergencyLevel);
    console.log("Max issuance rate:", params.maxIssuanceRateBps);
    
    // Set NAV to 1:1 conversion rate (enable emergency to bypass NAV_JUMP)
    await oracle.setEmergency(true);
    await setNavCompat(oracle, navRayFor1to1);
    const oneUSDC = USDC("1");

    // Get NAV and rate, calculate expected tokens
    const nav = await getNavRayCompat(oracle);
    const rate = await readIssuanceRateBps(cfg);
    const exp = expectedTokens(oneUSDC, nav, rate);

    // Call mintFor and assert exact amounts
    await expect(
      controller.connect(ops).mintFor(to.address, oneUSDC, 0, 0, SOVEREIGN_CODE)
    ).to.emit(controller, "Minted")
     .withArgs(to.address, oneUSDC, exp);

    // Verify token balance
    const balance = await token.balanceOf(to.address);
    expect(balance).to.equal(exp);
  });
});
