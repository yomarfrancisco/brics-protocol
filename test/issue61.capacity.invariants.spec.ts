/* Ensure bootstrap runs in local too */ 
import './bootstrap';

import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { USDC } from "./utils/units";
import { setNavCompat, getNavRayCompat } from "./utils/nav-helpers";
import { navRayFor1to1 } from "./utils/nav-math";
import { expectedTokens, readIssuanceRateBps } from "./utils/issuance-helpers";
import { deploySpec3Fixture } from "./helpers/spec3.fixture";

describe("SPEC §3 invariants (fast)", () => {
  it("remaining capacity never increases after a successful mint", async () => {
    const fx = await loadFixture(deploySpec3Fixture);
    await fx.configRegistry.connect(fx.gov)
      .addSovereign(fx.SOVEREIGN_CODE, 10000, 0, 0, true);
    await fx.issuanceController.connect(fx.gov)
      .setSovereignCap(fx.SOVEREIGN_CODE, USDC("200"), USDC("200"));

    await fx.navOracle.setEmergency(true);
    await setNavCompat(fx.navOracle, navRayFor1to1);

    // fund & approve
    await fx.usdc.mint(fx.ops.address, USDC("1000"));
    await fx.usdc.connect(fx.ops).approve(fx.issuanceController.target, USDC("1000"));

    // read baseline remaining
    const nav = await getNavRayCompat(fx.navOracle);
    const rate = await readIssuanceRateBps(fx.configRegistry);
    const first = USDC("70");
    const tx1 = await fx.issuanceController.connect(fx.ops)
      .mintFor(fx.user.address, first, 0, 0, fx.SOVEREIGN_CODE);
    const exp1 = expectedTokens(first, nav, rate);
    await expect(tx1).to.emit(fx.issuanceController, "Minted")
      .withArgs(fx.user.address, first, exp1);

    // ask controller again after mint whether a larger amount is now allowed
    // any allowed amount must be <= previous remaining
    const ask = USDC("150"); // bigger than remaining after first mint
    const ok = await fx.issuanceController.canIssue(ask, 0, 0, fx.SOVEREIGN_CODE);
    expect(ok).to.equal(false);
  });
});
