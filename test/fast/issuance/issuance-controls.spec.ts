import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("IssuanceControllerV4: adaptive issuance controls", () => {
  let controller: any;
  let configRegistry: any;
  let bricsToken: any;
  let owner: any;
  let gov: any;
  let ecc: any;
  let user: any;

  const INITIAL_CAP = ethers.parseUnits("1000000", 18); // 1M BRICS
  const INITIAL_DETACHMENT = 10100; // 101.00%

  beforeEach(async () => {
    [owner, gov, ecc, user] = await ethers.getSigners();

    // Deploy mock contracts
    const MockConfigRegistry = await ethers.getContractFactory("MockConfigRegistry");
    configRegistry = await MockConfigRegistry.deploy();
    await configRegistry.waitForDeployment();

    const MockBRICSToken = await ethers.getContractFactory("MockBRICSToken");
    bricsToken = await MockBRICSToken.deploy();
    await bricsToken.waitForDeployment();

    // Deploy IssuanceControllerV4
    const IssuanceControllerV4 = await ethers.getContractFactory("IssuanceControllerV4");
    controller = await IssuanceControllerV4.deploy(
      await configRegistry.getAddress(),
      await bricsToken.getAddress(),
      INITIAL_CAP,
      INITIAL_DETACHMENT
    );
    await controller.waitForDeployment();

    // Grant roles
    await controller.grantRole(await controller.GOV_ROLE(), await gov.getAddress());
    await controller.grantRole(await controller.ECC_ROLE(), await ecc.getAddress());

    // Mint some initial tokens to simulate existing supply
    await bricsToken.mint(await user.getAddress(), ethers.parseUnits("100000", 18));
  });

  describe("Green happy path", () => {
    it("allows minting when all conditions are met", async () => {
      const mintAmount = ethers.parseUnits("1000", 18);
      
      const canMint = await controller.canMint(mintAmount);
      expect(canMint).to.be.true;

      await expect(controller.checkMintAllowed(mintAmount)).to.not.be.reverted;
    });
  });

  describe("RED halt", () => {
    it("reverts minting when emergency level is RED", async () => {
      // Set emergency level to RED (2)
      await configRegistry.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 2);

      const mintAmount = ethers.parseUnits("1000", 18);
      
      await expect(controller.checkMintAllowed(mintAmount))
        .to.be.revertedWith("IC/RED_HALT");

      const canMint = await controller.canMint(mintAmount);
      expect(canMint).to.be.false;
    });

    it("allows minting when emergency level is not RED", async () => {
      // Set emergency level to AMBER (1)
      await configRegistry.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 1);

      const mintAmount = ethers.parseUnits("1000", 18);
      
      await expect(controller.checkMintAllowed(mintAmount)).to.not.be.reverted;
    });
  });

  describe("Lock/unlock", () => {
    it("reverts minting when issuance is locked", async () => {
      await controller.connect(ecc).lockIssuance();
      
      const mintAmount = ethers.parseUnits("1000", 18);
      
      await expect(controller.checkMintAllowed(mintAmount))
        .to.be.revertedWith("IC/LOCKED");

      const canMint = await controller.canMint(mintAmount);
      expect(canMint).to.be.false;
    });

    it("allows minting after unlocking", async () => {
      await controller.connect(ecc).lockIssuance();
      await controller.connect(ecc).unlockIssuance();
      
      const mintAmount = ethers.parseUnits("1000", 18);
      
      await expect(controller.checkMintAllowed(mintAmount)).to.not.be.reverted;
    });

    it("emits correct events for lock/unlock", async () => {
      await expect(controller.connect(ecc).lockIssuance())
        .to.emit(controller, "IssuanceLocked");

      await expect(controller.connect(ecc).unlockIssuance())
        .to.emit(controller, "IssuanceUnlocked");
    });
  });

  describe("Cap enforcement", () => {
    it("reverts minting when exceeding cap", async () => {
      const currentSupply = await bricsToken.totalSupply();
      const availableCap = INITIAL_CAP - currentSupply;
      const overCapAmount = availableCap + ethers.parseUnits("1", 18);
      
      await expect(controller.checkMintAllowed(overCapAmount))
        .to.be.revertedWith("IC/CAP");

      const canMint = await controller.canMint(overCapAmount);
      expect(canMint).to.be.false;
    });

    it("allows minting up to cap", async () => {
      const currentSupply = await bricsToken.totalSupply();
      const availableCap = INITIAL_CAP - currentSupply;
      
      await expect(controller.checkMintAllowed(availableCap)).to.not.be.reverted;
    });

    it("allows cap adjustment", async () => {
      const newCap = ethers.parseUnits("2000000", 18);
      
      await expect(controller.connect(gov).setSuperSeniorCap(newCap))
        .to.emit(controller, "CapAdjusted")
        .withArgs(newCap);

      expect(await controller.superSeniorCap()).to.equal(newCap);
    });
  });

  describe("Detachment raise with ratification", () => {
    it("raises detachment and sets ratification window", async () => {
      const newDetachment = 10200; // 102.00%
      const currentTime = await time.latest();
      
      const tx = await controller.connect(gov).raiseDetachment(newDetachment);
      const receipt = await tx.wait();
      
      // Find the DetachmentRaised event
      const event = receipt?.logs.find((log: any) => 
        log.fragment?.name === 'DetachmentRaised'
      );
      
      expect(event).to.not.be.undefined;
      expect(event?.args[0]).to.equal(newDetachment);
      expect(event?.args[1]).to.be.closeTo(currentTime + 24 * 60 * 60, 2); // Allow 2 second tolerance

      expect(await controller.detachmentBps()).to.equal(newDetachment);
      expect(await controller.lastDetachmentRaiseTs()).to.be.closeTo(currentTime, 2); // Allow 2 second tolerance
      expect(await controller.pendingRatifyUntil()).to.be.closeTo(currentTime + 24 * 60 * 60, 2); // Allow 2 second tolerance
    });

    it("allows minting during ratification window", async () => {
      await controller.connect(gov).raiseDetachment(10200);
      
      const mintAmount = ethers.parseUnits("1000", 18);
      await expect(controller.checkMintAllowed(mintAmount)).to.not.be.reverted;
    });

    it("reverts minting after ratification expires", async () => {
      await controller.connect(gov).raiseDetachment(10200);
      
      // Advance time past ratification window
      await time.increase(25 * 60 * 60); // 25 hours
      
      const mintAmount = ethers.parseUnits("1000", 18);
      await expect(controller.checkMintAllowed(mintAmount))
        .to.be.revertedWith("IC/RATIFY_EXPIRED");
    });

    it("allows ratification within window", async () => {
      await controller.connect(gov).raiseDetachment(10200);
      
      await expect(controller.connect(gov).ratifyDetachment())
        .to.emit(controller, "DetachmentRatified");

      expect(await controller.pendingRatifyUntil()).to.equal(0);
    });

    it("allows minting after ratification", async () => {
      await controller.connect(gov).raiseDetachment(10200);
      await controller.connect(gov).ratifyDetachment();
      
      const mintAmount = ethers.parseUnits("1000", 18);
      await expect(controller.checkMintAllowed(mintAmount)).to.not.be.reverted;
    });

    it("reverts ratification after window expires", async () => {
      await controller.connect(gov).raiseDetachment(10200);
      
      // Advance time past ratification window
      await time.increase(25 * 60 * 60); // 25 hours
      
      await expect(controller.connect(gov).ratifyDetachment())
        .to.be.revertedWith("IC/RATIFY_EXPIRED");
    });
  });

  describe("Detachment monotonicity", () => {
    it("reverts lowering detachment before cooldown", async () => {
      await controller.connect(gov).raiseDetachment(10200);
      
      // Try to lower immediately
      await expect(controller.connect(gov).lowerDetachment(10000))
        .to.be.revertedWith("IC/COOLDOWN");
    });

    it("reverts lowering detachment with pending ratification", async () => {
      await controller.connect(gov).raiseDetachment(10200);
      
      // Advance time past cooldown but don't ratify
      await time.increase(8 * 24 * 60 * 60); // 8 days
      
      await expect(controller.connect(gov).lowerDetachment(10000))
        .to.be.revertedWith("IC/PENDING_RATIFY");
    });

    it("allows lowering detachment after cooldown and ratification", async () => {
      await controller.connect(gov).raiseDetachment(10200);
      await controller.connect(gov).ratifyDetachment();
      
      // Advance time past cooldown
      await time.increase(8 * 24 * 60 * 60); // 8 days
      
      const newDetachment = 10000; // 100.00%
      await expect(controller.connect(gov).lowerDetachment(newDetachment))
        .to.emit(controller, "DetachmentLowered")
        .withArgs(newDetachment);

      expect(await controller.detachmentBps()).to.equal(newDetachment);
    });

    it("reverts raising detachment to same or lower value", async () => {
      await expect(controller.connect(gov).raiseDetachment(INITIAL_DETACHMENT))
        .to.be.revertedWith("IC/ONLY_UP");

      await expect(controller.connect(gov).raiseDetachment(INITIAL_DETACHMENT - 100))
        .to.be.revertedWith("IC/ONLY_UP");
    });

    it("reverts lowering detachment to same or higher value", async () => {
      await expect(controller.connect(gov).lowerDetachment(INITIAL_DETACHMENT))
        .to.be.revertedWith("IC/ONLY_DOWN");

      await expect(controller.connect(gov).lowerDetachment(INITIAL_DETACHMENT + 100))
        .to.be.revertedWith("IC/ONLY_DOWN");
    });
  });

  describe("Triggers", () => {
    it("fires triggers for high sovereign usage", async () => {
      const sovereignUsageBps = 2500; // 25% > 20% threshold
      
      await expect(controller.connect(ecc).adjustByTriggers(0, sovereignUsageBps, 0))
        .to.emit(controller, "TriggersFired")
        .withArgs(0, sovereignUsageBps, 0, INITIAL_CAP * 90n / 100n, INITIAL_DETACHMENT + 100);

      expect(await controller.superSeniorCap()).to.equal(INITIAL_CAP * 90n / 100n);
      expect(await controller.detachmentBps()).to.equal(INITIAL_DETACHMENT + 100);
      expect(await controller.pendingRatifyUntil()).to.be.gt(0);
    });

    it("fires triggers for high defaults", async () => {
      const defaultsBps = 600; // 6% > 5% threshold
      
      await expect(controller.connect(ecc).adjustByTriggers(defaultsBps, 0, 0))
        .to.emit(controller, "TriggersFired")
        .withArgs(defaultsBps, 0, 0, INITIAL_CAP * 85n / 100n, INITIAL_DETACHMENT + 200);

      expect(await controller.superSeniorCap()).to.equal(INITIAL_CAP * 85n / 100n);
      expect(await controller.detachmentBps()).to.equal(INITIAL_DETACHMENT + 200);
    });

    it("fires triggers for high correlation", async () => {
      const correlationBps = 7000; // 70% > 65% threshold
      
      await expect(controller.connect(ecc).adjustByTriggers(0, 0, correlationBps))
        .to.emit(controller, "TriggersFired")
        .withArgs(0, 0, correlationBps, INITIAL_CAP * 80n / 100n, INITIAL_DETACHMENT + 300);

      expect(await controller.superSeniorCap()).to.equal(INITIAL_CAP * 80n / 100n);
      expect(await controller.detachmentBps()).to.equal(INITIAL_DETACHMENT + 300);
    });

    it("fires multiple triggers simultaneously", async () => {
      const defaultsBps = 600; // 6%
      const sovereignUsageBps = 2500; // 25%
      const correlationBps = 7000; // 70%
      
      await expect(controller.connect(ecc).adjustByTriggers(defaultsBps, sovereignUsageBps, correlationBps))
        .to.emit(controller, "TriggersFired")
        .withArgs(defaultsBps, sovereignUsageBps, correlationBps, INITIAL_CAP * 80n / 100n, INITIAL_DETACHMENT + 600);

      // Should apply the most severe reduction (correlation trigger) and cumulative detachment increases
      expect(await controller.superSeniorCap()).to.equal(INITIAL_CAP * 80n / 100n);
      expect(await controller.detachmentBps()).to.equal(INITIAL_DETACHMENT + 600); // 100 + 200 + 300 = 600
    });

    it("does not fire triggers when thresholds not met", async () => {
      const defaultsBps = 400; // 4% < 5% threshold
      const sovereignUsageBps = 1500; // 15% < 20% threshold
      const correlationBps = 6000; // 60% < 65% threshold
      
      await expect(controller.connect(ecc).adjustByTriggers(defaultsBps, sovereignUsageBps, correlationBps))
        .to.not.emit(controller, "TriggersFired");

      expect(await controller.superSeniorCap()).to.equal(INITIAL_CAP);
      expect(await controller.detachmentBps()).to.equal(INITIAL_DETACHMENT);
    });
  });

  describe("Access control", () => {
    it("only allows GOV role to adjust cap", async () => {
      await expect(controller.connect(user).setSuperSeniorCap(INITIAL_CAP * 2n))
        .to.be.revertedWith("IC/ONLY_GOV");
    });

    it("only allows GOV role to raise detachment", async () => {
      await expect(controller.connect(user).raiseDetachment(10200))
        .to.be.revertedWith("IC/ONLY_GOV");
    });

    it("only allows GOV role to lower detachment", async () => {
      await expect(controller.connect(user).lowerDetachment(10000))
        .to.be.revertedWith("IC/ONLY_GOV");
    });

    it("only allows GOV role to ratify detachment", async () => {
      await controller.connect(gov).raiseDetachment(10200);
      
      await expect(controller.connect(user).ratifyDetachment())
        .to.be.revertedWith("IC/ONLY_GOV");
    });

    it("only allows ECC role to lock issuance", async () => {
      await expect(controller.connect(user).lockIssuance())
        .to.be.revertedWith("IC/ONLY_ECC");
    });

    it("only allows ECC role to unlock issuance", async () => {
      await expect(controller.connect(user).unlockIssuance())
        .to.be.revertedWith("IC/ONLY_ECC");
    });

    it("only allows ECC role to adjust by triggers", async () => {
      await expect(controller.connect(user).adjustByTriggers(1000, 1000, 1000))
        .to.be.revertedWith("IC/ONLY_ECC");
    });
  });

  describe("View functions", () => {
    it("returns correct current state", async () => {
      const [cap, detachment, locked, ratifyUntil, emergencyLevel] = await controller.getCurrentState();
      
      expect(cap).to.equal(INITIAL_CAP);
      expect(detachment).to.equal(INITIAL_DETACHMENT);
      expect(locked).to.be.false;
      expect(ratifyUntil).to.equal(0);
      expect(emergencyLevel).to.equal(0);
    });

    it("returns correct state after changes", async () => {
      await controller.connect(ecc).lockIssuance();
      await controller.connect(gov).raiseDetachment(10200);
      await configRegistry.setUint(ethers.keccak256(ethers.toUtf8Bytes("emergency.level")), 1);

      const [cap, detachment, locked, ratifyUntil, emergencyLevel] = await controller.getCurrentState();
      
      expect(cap).to.equal(INITIAL_CAP);
      expect(detachment).to.equal(10200);
      expect(locked).to.be.true;
      expect(ratifyUntil).to.be.gt(0);
      expect(emergencyLevel).to.equal(1);
    });
  });
});
