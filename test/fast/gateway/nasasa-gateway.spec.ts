// Updated tests for new lifecycle: Queued -> Struck -> Settled (T+5 payout)

import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("NASASAGateway: redemption lifecycle", () => {
  let gateway: any;
  let queue: any;
  let claim: any;
  let usdc: any;
  let brics: any;
  let navOracle: any;
  let configRegistry: any;
  let owner: any;
  let user: any;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    // Deploy mock contracts
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const MockBRICSToken = await ethers.getContractFactory("MockBRICSToken");
    brics = await MockBRICSToken.deploy();

    const MockNAVOracle = await ethers.getContractFactory("MockNAVOracle");
    navOracle = await MockNAVOracle.deploy();

    const MockRedemptionClaim = await ethers.getContractFactory("MockRedemptionClaim");
    claim = await MockRedemptionClaim.deploy();

    const MockAccessController = await ethers.getContractFactory("MockAccessController");
    const accessController = await MockAccessController.deploy();

    const MockConfigRegistry = await ethers.getContractFactory("MockConfigRegistry");
    configRegistry = await MockConfigRegistry.deploy();

    const RedemptionQueue = await ethers.getContractFactory("RedemptionQueue");
    queue = await RedemptionQueue.deploy(await accessController.getAddress(), await configRegistry.getAddress());

    const NASASAGateway = await ethers.getContractFactory("NASASAGateway");
    gateway = await NASASAGateway.deploy(
      await usdc.getAddress(),
      await brics.getAddress(),
      await claim.getAddress(),
      await queue.getAddress(),
      await navOracle.getAddress(),
      await configRegistry.getAddress()
    );

    // Grant admin role to gateway
    await accessController.grantRole(await queue.ADMIN_ROLE(), await gateway.getAddress());

    // Set up initial state
    await navOracle.setNavRay(ethers.parseUnits("1", 27)); // NAV = 1.00
    await usdc.mint(await gateway.getAddress(), ethers.parseUnits("1000000", 6)); // Fund gateway
  });

  it("queues -> strikes (no payout) -> settles (T+5 payout)", async () => {
    const amount = ethers.parseUnits("250", 18);

    // Queue primary claim
    const tx = await gateway.connect(user).queueRedemptionPrimary(amount);
    const receipt = await tx.wait();
    
    // Extract claim ID from event
    const event = receipt?.logs.find((log: any) => {
      try {
        const parsed = queue.interface.parseLog(log);
        return parsed?.name === "ClaimQueued";
      } catch {
        return false;
      }
    });
    const claimId = event ? queue.interface.parseLog(event).args.claimId : 0;

    expect(claimId).to.equal(0); // First claim should have ID 0

    // Check claim is queued
    const queuedClaim = await queue.claims(claimId);
    expect(queuedClaim.status).to.equal(0); // Queued
    expect(queuedClaim.owner).to.equal(await user.getAddress());
    expect(queuedClaim.tokens).to.equal(amount);

    // Month-end strike: moves claim to Struck with usdcOwed, but does not pay
    const navRay = ethers.parseUnits("1", 27);
    await navOracle.setNavRay(navRay);
    await gateway.processMonthEndStrike([claimId]);

    const struckClaim = await queue.claims(claimId);
    expect(struckClaim.status).to.equal(1); // Struck
    expect(struckClaim.usdcOwed).to.be.gt(0);
    expect(struckClaim.struckAt).to.be.gt(0);

    // Calculate expected USDC amount
    const expectedUsdc = (amount * navRay) / ethers.parseUnits("1", 27) / ethers.parseUnits("1", 12);
    expect(struckClaim.usdcOwed).to.equal(expectedUsdc);

    // Settle within T+5
    const before = await usdc.balanceOf(await user.getAddress());
    await gateway.connect(user).settleClaim(claimId);
    const after = await usdc.balanceOf(await user.getAddress());
    expect(after - before).to.equal(struckClaim.usdcOwed);

    // Double settlement must fail
    await expect(gateway.connect(user).settleClaim(claimId)).to.be.revertedWith("GW/NOT_STRUCK");
  });

  it("reverts settlement after T+5 window", async () => {
    const amount = ethers.parseUnits("250", 18);

    // Queue and strike claim
    const tx = await gateway.connect(user).queueRedemptionPrimary(amount);
    const receipt = await tx.wait();
    const event = receipt?.logs.find((log: any) => {
      try {
        const parsed = queue.interface.parseLog(log);
        return parsed?.name === "ClaimQueued";
      } catch {
        return false;
      }
    });
    const claimId = event ? queue.interface.parseLog(event).args.claimId : 0;

    await gateway.processMonthEndStrike([claimId]);

    // Advance time past T+5 window
    await time.increase(6 * 24 * 60 * 60); // 6 days

    // Settlement should fail
    await expect(gateway.connect(user).settleClaim(claimId)).to.be.revertedWith("GW/WINDOW_EXPIRED");
  });

  it("reverts settlement by non-owner", async () => {
    const amount = ethers.parseUnits("250", 18);
    const signers = await ethers.getSigners();
    const otherUser = signers[2]; // Use a different signer

    // Queue and strike claim
    const tx = await gateway.connect(user).queueRedemptionPrimary(amount);
    const receipt = await tx.wait();
    const event = receipt?.logs.find((log: any) => {
      try {
        const parsed = queue.interface.parseLog(log);
        return parsed?.name === "ClaimQueued";
      } catch {
        return false;
      }
    });
    const claimId = event ? queue.interface.parseLog(event).args.claimId : 0;

    await gateway.processMonthEndStrike([claimId]);

    // Verify the claim belongs to the original user
    const claim = await queue.claims(claimId);
    expect(claim.owner).to.equal(await user.getAddress());
    expect(claim.owner).to.not.equal(await otherUser.getAddress());

    // Other user tries to settle
    await expect(gateway.connect(otherUser).settleClaim(claimId)).to.be.revertedWith("GW/NOT_OWNER");
  });

  it("reverts settlement of non-struck claim", async () => {
    const amount = ethers.parseUnits("250", 18);

    // Queue claim but don't strike it
    const tx = await gateway.connect(user).queueRedemptionPrimary(amount);
    const receipt = await tx.wait();
    const event = receipt?.logs.find((log: any) => {
      try {
        const parsed = queue.interface.parseLog(log);
        return parsed?.name === "ClaimQueued";
      } catch {
        return false;
      }
    });
    const claimId = event ? queue.interface.parseLog(event).args.claimId : 0;

    // Try to settle without striking
    await expect(gateway.connect(user).settleClaim(claimId)).to.be.revertedWith("GW/NOT_STRUCK");
  });

  it("processes multiple claims in batch", async () => {
    const [_, user2] = await ethers.getSigners();
    const amount = ethers.parseUnits("100", 18);

    // Queue claims from two users
    const tx1 = await gateway.connect(user).queueRedemptionPrimary(amount);
    const receipt1 = await tx1.wait();
    const event1 = receipt1?.logs.find((log: any) => {
      try {
        const parsed = queue.interface.parseLog(log);
        return parsed?.name === "ClaimQueued";
      } catch {
        return false;
      }
    });
    const claimId1 = event1 ? queue.interface.parseLog(event1).args.claimId : 0;

    const tx2 = await gateway.connect(user2).queueRedemptionPrimary(amount);
    const receipt2 = await tx2.wait();
    const event2 = receipt2?.logs.find((log: any) => {
      try {
        const parsed = queue.interface.parseLog(log);
        return parsed?.name === "ClaimQueued";
      } catch {
        return false;
      }
    });
    const claimId2 = event2 ? queue.interface.parseLog(event2).args.claimId : 1;

    // Strike both claims
    await gateway.processMonthEndStrike([claimId1, claimId2]);

    // Both claims should be struck
    const claim1 = await queue.claims(claimId1);
    const claim2 = await queue.claims(claimId2);
    expect(claim1.status).to.equal(1); // Struck
    expect(claim2.status).to.equal(1); // Struck

    // Both users can settle
    await gateway.connect(user).settleClaim(claimId1);
    await gateway.connect(user2).settleClaim(claimId2);
  });

  it("reverts if trying to settle after window expiry", async () => {
    // Set a custom settlement window of 1 day
    const settleWindowSec = 24 * 60 * 60; // 1 day
    await configRegistry.setUint(await gateway.CFG_SETTLE_WINDOW_SEC(), settleWindowSec);

    const amount = ethers.parseUnits("10", 18);
    const tx = await gateway.connect(user).queueRedemptionPrimary(amount);
    const receipt = await tx.wait();
    const event = receipt?.logs.find((log: any) => {
      try {
        const parsed = queue.interface.parseLog(log);
        return parsed?.name === "ClaimQueued";
      } catch {
        return false;
      }
    });
    const claimId = event ? queue.interface.parseLog(event).args.claimId : 0;

    await navOracle.setNavRay(ethers.parseUnits("1", 27));
    await gateway.processMonthEndStrike([claimId]);

    // Advance time past 1 day window
    await time.increase(2 * 24 * 60 * 60); // 2 days

    await expect(gateway.connect(user).settleClaim(claimId)).to.be.revertedWith("GW/WINDOW_EXPIRED");
  });

  it("cannot strike a claim twice", async () => {
    const amount = ethers.parseUnits("5", 18);
    const tx = await gateway.connect(user).queueRedemptionPrimary(amount);
    const receipt = await tx.wait();
    const event = receipt?.logs.find((log: any) => {
      try {
        const parsed = queue.interface.parseLog(log);
        return parsed?.name === "ClaimQueued";
      } catch {
        return false;
      }
    });
    const claimId = event ? queue.interface.parseLog(event).args.claimId : 0;

    await navOracle.setNavRay(ethers.parseUnits("1", 27));
    await gateway.processMonthEndStrike([claimId]);

    // Try to strike the same claim again
    await expect(gateway.processMonthEndStrike([claimId])).to.be.revertedWith("RQ/NOT_QUEUED");
  });
});
