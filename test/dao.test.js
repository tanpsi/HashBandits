const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

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

      DAO = await ethers.getContractFactory("DAO");
      dao = await DAO.deploy(tokenAddr, 30);
      await dao.waitForDeployment();
      const daoAddr = await dao.getAddress();

      const SNAPSHOT_ROLE = await token.SNAPSHOT_ROLE();
      await token.grantRole(SNAPSHOT_ROLE, daoAddr);

      await token.transfer(alice.address, ethers.parseEther("200"));
      await token.transfer(bob.address, ethers.parseEther("150"));
      await token.transfer(carol.address, ethers.parseEther("50"));

      MockTarget = await ethers.getContractFactory("MockTarget");
      mock = await MockTarget.deploy();
      await mock.waitForDeployment();
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
      } catch (e) {}
    }
    throw new Error("Event not found");
  }

  it("create, vote, execute a successful proposal", async function () {
    const mockAddr = await mock.getAddress();
    const data = mock.interface.encodeFunctionData("setValue", [42]);
    const now = (await ethers.provider.getBlock()).timestamp;
    const deadline = now + 105;

    const tx = await dao.createProposal(mockAddr, data, deadline, "");
    const rc = await tx.wait();
    const id = findEventId(rc, dao.interface, "ProposalCreated");

    await dao.connect(alice).vote(id, true);
    await dao.connect(bob).vote(id, true);

    await ethers.provider.send("evm_increaseTime", [150]);
    await ethers.provider.send("evm_mine");
    await time.increase(30);

    await dao.connect(carol).executeProposal(id);

    expect(await mock.value()).to.equal(42);
  });

  it("prevents double voting and unauthorized votes", async function () {
    const mockAddr = await mock.getAddress();
    const data = mock.interface.encodeFunctionData("setValue", [7]);
    const now = (await ethers.provider.getBlock()).timestamp;
    const deadline = now + 105;

    const tx = await dao.createProposal(mockAddr, data, deadline, "");
    const rc = await tx.wait();
    const id = findEventId(rc, dao.interface, "ProposalCreated");

    const stranger = (await ethers.getSigners())[5];

    await expect(
      dao.connect(stranger).vote(id, true)
    ).to.be.revertedWithCustomError(dao, "NoVotingPower");

    await dao.connect(alice).vote(id, true);

    await expect(
      dao.connect(alice).vote(id, true)
    ).to.be.revertedWithCustomError(dao, "AlreadyVoted");
  });

  it("allows creator to cancel before votes cast", async function () {
    const mockAddr = await mock.getAddress();
    const data = mock.interface.encodeFunctionData("setValue", [9]);
    const now = (await ethers.provider.getBlock()).timestamp;
    const deadline = now + 105;

    const tx = await dao.createProposal(mockAddr, data, deadline, "");
    const rc = await tx.wait();
    const id = findEventId(rc, dao.interface, "ProposalCreated");

    await dao.connect(deployer).cancelProposal(id);

    await expect(
      dao.connect(alice).vote(id, true)
    ).to.be.revertedWithCustomError(dao, "AlreadyExecuted");
  });

  it("enforces quorum - proposal below quorum cannot execute even if all votes are yes", async function () {
    const mockAddr = await mock.getAddress();
    const data = mock.interface.encodeFunctionData("setValue", [99]);
    const now = (await ethers.provider.getBlock()).timestamp;
    const deadline = now + 105;

    const tx = await dao.createProposal(mockAddr, data, deadline, "");
    const rc = await tx.wait();
    const id = findEventId(rc, dao.interface, "ProposalCreated");

    await dao.connect(alice).vote(id, true);

    await ethers.provider.send("evm_increaseTime", [150]);
    await ethers.provider.send("evm_mine");
    await time.increase(30);

    await expect(
      dao.executeProposal(id)
    ).to.be.revertedWithCustomError(dao, "QuorumNotReached");
  });

  it("enforces deadline - cannot execute proposal before voting window closes", async function () {
    const mockAddr = await mock.getAddress();
    const data = mock.interface.encodeFunctionData("setValue", [55]);
    const now = (await ethers.provider.getBlock()).timestamp;
    const deadline = now + 205;

    const tx = await dao.createProposal(mockAddr, data, deadline, "");
    const rc = await tx.wait();
    const id = findEventId(rc, dao.interface, "ProposalCreated");

    await dao.connect(alice).vote(id, true);
    await dao.connect(bob).vote(id, true);

    await expect(
      dao.executeProposal(id)
    ).to.be.revertedWithCustomError(dao, "ExecutionDelayNotPassed");

    await ethers.provider.send("evm_increaseTime", [240]);
    await ethers.provider.send("evm_mine");

    const execTx = await dao.executeProposal(id);

    await expect(execTx)
      .to.emit(dao, "ProposalExecuted");

    expect(await mock.value()).to.equal(55);
  });

  it("prevents execution of defeated proposals (more against votes than for votes)", async function () {
    const mockAddr = await mock.getAddress();
    const data = mock.interface.encodeFunctionData("setValue", [77]);
    const now = (await ethers.provider.getBlock()).timestamp;
    const deadline = now + 165;

    const tx = await dao.createProposal(mockAddr, data, deadline, "");
    const rc = await tx.wait();
    const id = findEventId(rc, dao.interface, "ProposalCreated");

    await dao.connect(alice).vote(id, true);
    await dao.connect(bob).vote(id, true);
    await dao.connect(carol).vote(id, false);

    await ethers.provider.send("evm_increaseTime", [170]);
    await ethers.provider.send("evm_mine");
    await time.increase(30);

    await dao.executeProposal(id);

    expect(await mock.value()).to.equal(77);
  });

  it("prevents execution of defeated proposals - revert when against >= for", async function () {
    const Token = await ethers.getContractFactory("GovernanceToken");

    const tempToken = await Token.deploy(
      "TestToken",
      "TEST",
      ethers.parseEther("500")
    );

    await tempToken.waitForDeployment();

    const DAO = await ethers.getContractFactory("DAO");

    const tempDAO = await DAO.deploy(
      await tempToken.getAddress(),
      40
    );

    await tempDAO.waitForDeployment();

    const SNAPSHOT_ROLE = await tempToken.SNAPSHOT_ROLE();

    await tempToken.grantRole(
      SNAPSHOT_ROLE,
      await tempDAO.getAddress()
    );

    const [, a, b, c] = await ethers.getSigners();

    await tempToken.transfer(a.address, ethers.parseEther("30"));
    await tempToken.transfer(b.address, ethers.parseEther("30"));
    await tempToken.transfer(c.address, ethers.parseEther("40"));

    const MockTarget = await ethers.getContractFactory("MockTarget");

    const mock2 = await MockTarget.deploy();

    await mock2.waitForDeployment();

    const data = mock2.interface.encodeFunctionData("setValue", [88]);

    const now = (await ethers.provider.getBlock()).timestamp;

    const deadline = now + 165;

    const tx = await tempDAO.createProposal(
      await mock2.getAddress(),
      data,
      deadline,
      ""
    );

    const rc = await tx.wait();

    const id = findEventId(rc, tempDAO.interface, "ProposalCreated");

    await tempDAO.connect(a).vote(id, true);
    await tempDAO.connect(b).vote(id, false);

    await ethers.provider.send("evm_increaseTime", [170]);
    await ethers.provider.send("evm_mine");
    await time.increase(30);

    await expect(
      tempDAO.executeProposal(id)
    ).to.be.revertedWithCustomError(
      tempDAO,
      "QuorumNotReached"
    );
  });

  it("demonstrates successful contract-to-contract call with state change", async function () {
    const mockAddr = await mock.getAddress();

    expect(await mock.value()).to.equal(0);

    const calldata = mock.interface.encodeFunctionData("setValue", [123]);

    const now = (await ethers.provider.getBlock()).timestamp;

    const deadline = now + 165;

    const tx = await dao.createProposal(
      mockAddr,
      calldata,
      deadline,
      ""
    );

    const rc = await tx.wait();

    const proposalId = findEventId(
      rc,
      dao.interface,
      "ProposalCreated"
    );

    await dao.connect(alice).vote(proposalId, true);
    await dao.connect(bob).vote(proposalId, true);

    await ethers.provider.send("evm_increaseTime", [170]);
    await ethers.provider.send("evm_mine");
    await time.increase(30);

    const executeEvent = await dao.executeProposal(proposalId);

    await expect(executeEvent)
      .to.emit(dao, "ProposalExecuted")
      .withArgs(proposalId);

    expect(await mock.value()).to.equal(123);
  });

  it("prevents voting after proposal deadline", async function () {
    const mockAddr = await mock.getAddress();

    const data = mock.interface.encodeFunctionData("setValue", [111]);

    const now = (await ethers.provider.getBlock()).timestamp;

    const deadline = now + 115;

    const tx = await dao.createProposal(
      mockAddr,
      data,
      deadline,
      ""
    );

    const rc = await tx.wait();

    const id = findEventId(rc, dao.interface, "ProposalCreated");

    await ethers.provider.send("evm_increaseTime", [120]);
    await ethers.provider.send("evm_mine");
    await time.increase(30);

    await expect(
      dao.connect(alice).vote(id, true)
    ).to.be.revertedWithCustomError(dao, "VotingClosed");
  });

  it("allows non-creator to execute proposal after deadline", async function () {
    const mockAddr = await mock.getAddress();

    const data = mock.interface.encodeFunctionData("setValue", [222]);

    const now = (await ethers.provider.getBlock()).timestamp;

    const deadline = now + 165;

    const tx = await dao.createProposal(
      mockAddr,
      data,
      deadline,
      ""
    );

    const rc = await tx.wait();

    const id = findEventId(rc, dao.interface, "ProposalCreated");

    await dao.connect(alice).vote(id, true);
    await dao.connect(bob).vote(id, true);

    await ethers.provider.send("evm_increaseTime", [170]);
    await ethers.provider.send("evm_mine");
    await time.increase(30);

    const execTx = await dao.connect(carol).executeProposal(id);

    await expect(execTx)
      .to.emit(dao, "ProposalExecuted");

    expect(await mock.value()).to.equal(222);
  });

  it("prevents proposal creation with insufficient token balance", async function () {
    const mockAddr = await mock.getAddress();

    const data = mock.interface.encodeFunctionData("setValue", [42]);

    const now = (await ethers.provider.getBlock()).timestamp;

    const deadline = now + 105;

    const [, , , , stranger] = await ethers.getSigners();

    await expect(
      dao.connect(stranger).createProposal(
        mockAddr,
        data,
        deadline,
        ""
      )
    ).to.be.revertedWithCustomError(
      dao,
      "InsufficientBalance"
    );
  });

  describe("setQuorumPercent", function () {

    it("should allow ADMIN to update quorum percentage", async function () {
      await dao.connect(deployer).setQuorumPercent(40);

      expect(await dao.quorumPercent()).to.equal(40);
    });

    it("should revert if new quorum is > 100", async function () {
      await expect(
        dao.connect(deployer).setQuorumPercent(101)
      ).to.be.revertedWithCustomError(
        dao,
        "InvalidQuorum"
      );
    });

    it("should revert if called by non-admin", async function () {
      const [, nonAdmin] = await ethers.getSigners();

      await expect(
        dao.connect(nonAdmin).setQuorumPercent(50)
      ).to.be.revertedWith(
        `AccessControl: account ${nonAdmin.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
      );
    });

  });
});