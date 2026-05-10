const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();
  console.log(`Starting load test with ${signers.length} accounts...`);

  // 1. Deploy Contracts
  const Token = await hre.ethers.getContractFactory("GovernanceToken");
  const initialSupply = process.env.INITIAL_SUPPLY || "1000000";
  const token = await Token.deploy("GovToken", "GOV", hre.ethers.parseEther(initialSupply));
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`Token deployed to: ${tokenAddr}`);

  const DAO = await hre.ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(tokenAddr, 10); // 10% quorum
  await dao.waitForDeployment();
  const daoAddr = await dao.getAddress();
  console.log(`DAO deployed to: ${daoAddr}`);

  const MockTarget = await hre.ethers.getContractFactory("MockTarget");
  const mock = await MockTarget.deploy();
  await mock.waitForDeployment();
  const mockAddr = await mock.getAddress();

  const SNAPSHOT_ROLE = await token.SNAPSHOT_ROLE();
  await token.grantRole(SNAPSHOT_ROLE, daoAddr);

  // 2. Distribute tokens and delegate/snapshot
  console.log("Distributing tokens to all accounts...");
  const distributeTx = [];
  for (let i = 1; i < signers.length; i++) {
    // Send 10 tokens to each
    distributeTx.push(token.transfer(signers[i].address, hre.ethers.parseEther("10")));
  }
  await Promise.all(distributeTx);

  // Take a snapshot if the GovernanceToken requires delegation or explicit snapshots
  // Assuming the GovernanceToken is an ERC20Snapshot or similar, we might just need to let the DAO take the snapshot.

  // 3. Create Proposal
  console.log("Creating proposal...");
  const admin = signers[0];
  const target = mockAddr;
  const data = mock.interface.encodeFunctionData("setValue", [42]);
  const latestBlock = await hre.ethers.provider.getBlock("latest");
  // Hardhat adds ~1 second per block. We add 1 second per signer + a 1-hour buffer.
  const deadline = latestBlock.timestamp + signers.length + 3600;
  const cid = "";

  const tx = await dao.connect(admin).createProposal(target, data, deadline, cid);
  const receipt = await tx.wait();

  const event = receipt.logs.find(
    (log) => log.fragment && log.fragment.name === "ProposalCreated"
  );
  const proposalId = event ? event.args[0] : 0n;
  console.log(`Proposal Created: ID ${proposalId}`);

  // 4. Load Test Voting
  console.log(`Simulating ${signers.length - 1} concurrent votes...`);
  const startTime = Date.now();

  // Submit all vote transactions concurrently
  const votePromises = [];
  for (let i = 1; i < signers.length; i++) {
    const voter = signers[i];
    // We send transactions concurrently
    const votePromise = dao.connect(voter).vote(proposalId, true).catch(e => {
      console.error(`Account ${i} vote failed:`, e.message);
    });
    votePromises.push(votePromise);
  }

  await Promise.all(votePromises);
  const endTime = Date.now();

  console.log(`\n--- Load Test Results ---`);
  console.log(`Total Votes Cast: ${signers.length - 1}`);
  console.log(`Time Taken: ${(endTime - startTime) / 1000} seconds`);
  console.log(`Throughput: ${((signers.length - 1) / ((endTime - startTime) / 1000)).toFixed(2)} tx/sec`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
