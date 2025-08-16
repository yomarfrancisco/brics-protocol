import { expect } from "chai";
import { ethers } from "hardhat";
import { BRICSTokenV1, TrancheControllerV1 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("smoke(tranche cap)", function () {
  let token: BRICSTokenV1;
  let controller: TrancheControllerV1;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let minter: SignerWithAddress;

  const CAP = ethers.parseUnits("1000", 18); // 1k shares

  beforeEach(async function () {
    [owner, user1, minter] = await ethers.getSigners();

    // Deploy token first
    const BRICSTokenV1Factory = await ethers.getContractFactory("BRICSTokenV1");
    token = await BRICSTokenV1Factory.deploy();

    // Deploy controller
    const TrancheControllerV1Factory = await ethers.getContractFactory("TrancheControllerV1");
    controller = await TrancheControllerV1Factory.deploy(await token.getAddress());

    // Set up roles
    await token.grantRole(await token.MINTER_ROLE(), minter.address);
    await token.setController(await controller.getAddress());

    // Set cap
    await controller.adjustSuperSeniorCap(CAP);
  });

  it("should mint to cap → ok; +1 wei → revert", async function () {
    // Mint exactly to cap
    await token.connect(minter).mintTo(user1.address, CAP);
    expect(await token.balanceOf(user1.address)).to.equal(CAP);
    expect(await token.totalSupply()).to.equal(CAP);

    // Try to mint +1 wei beyond cap
    await expect(
      token.connect(minter).mintTo(user1.address, 1n)
    ).to.be.revertedWithCustomError(token, "InvalidAmount");
  });
});
