const fs = require("fs");

function getArgValue(argName) {
  const argPrefix = `--${argName}=`;
  const argv = process.argv.slice(2);

  for (let argIndex = 0; argIndex < argv.length; argIndex++) {
    const arg = argv[argIndex];
    if (arg.startsWith(argPrefix)) {
      return arg.slice(argPrefix.length);
    }
    if (arg === `--${argName}` && argIndex + 1 < argv.length) {
      return argv[argIndex + 1];
    }
  }

  return undefined;
}

async function verify(hre, address, constructorArguments) {
  try {
    await hre.run("verify:verify", { address, constructorArguments });
  } catch (e) {
    if (e.message.includes("Already Verified")) {
      console.log("Already verified:", address);
    } else {
      console.warn("Verification failed for", address, "—", e.message);
    }
  }
}

async function main() {
  const hre = require("hardhat");
  const { ethers } = hre;

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, `(chainId: ${network.chainId})`);
  console.log("Deploying with", deployer.address);

  const TOKEN_NAME = "GovToken";
  const TOKEN_SYMBOL = "GOV";
  const initialSupplyInput = getArgValue("initial-supply") ?? process.env.INITIAL_SUPPLY ?? "1000";
  const TOKEN_SUPPLY = ethers.parseEther(initialSupplyInput);
  console.log(`Initial token supply: ${initialSupplyInput} ${TOKEN_SYMBOL}`);
  const QUORUM_PERCENT = 30;

  const Token = await ethers.getContractFactory("GovernanceToken");
  const token = await Token.deploy(TOKEN_NAME, TOKEN_SYMBOL, TOKEN_SUPPLY);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("Token deployed to", tokenAddress);

  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(tokenAddress, QUORUM_PERCENT);
  await dao.waitForDeployment();
  const daoAddress = await dao.getAddress();
  console.log("DAO deployed to", daoAddress);

  const SNAPSHOT_ROLE = await token.SNAPSHOT_ROLE();
  await token.grantRole(SNAPSHOT_ROLE, daoAddress);
  console.log("Granted snapshot role to DAO");

  const MockTarget = await ethers.getContractFactory("MockTarget");
  const target = await MockTarget.deploy();
  await target.waitForDeployment();
  const targetAddress = await target.getAddress();
  console.log("MockTarget deployed to", targetAddress);

  const addresses = { token: tokenAddress, dao: daoAddress, mockTarget: targetAddress };
  fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
  console.log("Addresses saved to deployed-addresses.json");

  // Etherscan verification only makes sense on live networks
  if (network.chainId !== 31337n) {
    console.log("\nWaiting 30s for Etherscan to index contracts...");
    await new Promise((r) => setTimeout(r, 30_000));

    await verify(hre, tokenAddress, [TOKEN_NAME, TOKEN_SYMBOL, TOKEN_SUPPLY]);
    await verify(hre, daoAddress, [tokenAddress, QUORUM_PERCENT]);
    await verify(hre, targetAddress, []);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
