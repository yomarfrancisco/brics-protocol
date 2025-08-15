import { expect } from "chai";
import { ethers } from "hardhat";
import { mintHappyFixture } from "./helpers/mint-happy.fixture";
import { USDC } from "./utils/units";

describe("BRICSToken — mint smoke", () => {
  it("token.mint works directly (MINTER_ROLE + membership satisfied)", async () => {
    const { token, controller, to, memberRegistry } = await mintHappyFixture();

    // Debug: Check all preconditions
    const MINTER_ROLE = await token.MINTER_ROLE();
    const hasMinterRole = await token.hasRole(MINTER_ROLE, await controller.getAddress());
    console.log("Controller has MINTER_ROLE:", hasMinterRole);
    
    const canReceive = await memberRegistry.canReceive(to.address);
    console.log("Recipient canReceive:", canReceive);
    
    const canSend = await memberRegistry.canSend(ethers.ZeroAddress);
    console.log("Zero address canSend:", canSend);
    
    const isMember = await memberRegistry.isMember(to.address);
    console.log("Recipient isMember:", isMember);

    // controller has MINTER_ROLE on token in the fixture
    await expect(token.connect(controller.runner).mint(to.address, ethers.parseEther("1")))
      .to.emit(token, "Transfer") // or the token's specific Mint event, adjust if different
      .withArgs(ethers.ZeroAddress, to.address, ethers.parseEther("1"));
  });
});
