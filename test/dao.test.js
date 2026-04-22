const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DAO governance flow", function () {
  let Token, DAO, MockTarget;
  let token, dao, mock;
  let deployer, alice, bob, carol;

  beforeEach(async function () {
    [deployer, alice, bob, carol] = await ethers.getSigners();

    try {
      Token = await ethers.getContractFactory("GovernanceToken");
      token = await Token.deploy("GovToken", "GOV", ethers.parseEther("1000"));
      await token.waitForDeployment();
      const tokenAddr = await token.getAddress();
      console.log("Token.address=", tokenAddr);

      DAO = await ethers.getContractFactory("DAO");
      dao = await DAO.deploy(tokenAddr, 30); // 30% quorum
      await dao.waitForDeployment();
      const daoAddr = await dao.getAddress();
      console.log("DAO.address=", daoAddr);

      // grant snapshot role to DAO
      const SNAPSHOT_ROLE = await token.SNAPSHOT_ROLE();
      console.log("SNAPSHOT_ROLE=", SNAPSHOT_ROLE);
      await token.grantRole(SNAPSHOT_ROLE, daoAddr);

      // distribute tokens
      await token.transfer(alice.address, ethers.parseEther("200"));
      await token.transfer(bob.address, ethers.parseEther("150"));
      await token.transfer(carol.address, ethers.parseEther("50"));

      MockTarget = await ethers.getContractFactory("MockTarget");
      mock = await MockTarget.deploy();
      await mock.waitForDeployment();
      const mockAddr = await mock.getAddress();
      console.log("Mock.address=", mockAddr);
    } catch (err) {
      console.error("beforeEach error", err);
      throw err;
    }
  });

  function findEventId(receipt, contractInterface, eventName) {
    for (const log of receipt.logs) {
      try {
        const parsed = contractInterface.parseLog(log);
        if (parsed && parsed.name === eventName) return parsed.args.id;
      } catch (e) {
        // ignore
      }
    }
    throw new Error("Event not found");
  }

  it("create, vote, execute a successful proposal", async function () {
    // create proposal to call mock.setValue(42)
    const mockAddr = await mock.getAddress();
    const data = mock.interface.encodeFunctionData("setValue", [42]);
    const now = (await ethers.provider.getBlock()).timestamp;
    const deadline = now + 60; // 60 seconds

    const tx = await dao.createProposal(mockAddr, data, deadline);
    const rc = await tx.wait();
    const id = findEventId(rc, dao.interface, "ProposalCreated");

    // alice votes for (200), bob votes for (150) => for = 350
    await dao.connect(alice).vote(id, true);
    await dao.connect(bob).vote(id, true);

    // move time forward past deadline
    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine");

    // execute
    await dao.connect(carol).executeProposal(id);
    expect(await mock.value()).to.equal(42);
  });

  it("prevents double voting and unauthorized votes", async function () {
    const mockAddr = await mock.getAddress();
    const data = mock.interface.encodeFunctionData("setValue", [7]);
    const now = (await ethers.provider.getBlock()).timestamp;
    const deadline = now + 60;
    const tx = await dao.createProposal(mockAddr, data, deadline);
    const rc = await tx.wait();
    const id = findEventId(rc, dao.interface, "ProposalCreated");

    // non-holder (new account) should fail
    const stranger = (await ethers.getSigners())[5];
    await expect(dao.connect(stranger).vote(id, true)).to.be.revertedWith(
      "No voting power",
    );

    // alice votes
    await dao.connect(alice).vote(id, true);
    // second time revert
    await expect(dao.connect(alice).vote(id, true)).to.be.revertedWith(
      "Already voted",
    );
  });

  it("allows creator to cancel before votes cast", async function () {
    const mockAddr = await mock.getAddress();
    const data = mock.interface.encodeFunctionData("setValue", [9]);
    const now = (await ethers.provider.getBlock()).timestamp;
    const deadline = now + 60;
    const tx = await dao.createProposal(mockAddr, data, deadline);
    const rc = await tx.wait();
    const id = findEventId(rc, dao.interface, "ProposalCreated");

    await dao.connect(deployer).cancelProposal(id);
    await expect(dao.connect(alice).vote(id, true)).to.be.revertedWith(
      "Already executed",
    );
  });
});
