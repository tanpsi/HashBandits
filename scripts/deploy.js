async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with", deployer.address);

  const Token = await ethers.getContractFactory("GovernanceToken");
  const token = await Token.deploy(
    "GovToken",
    "GOV",
    ethers.parseEther("1000"),
  );
  await token.waitForDeployment();
  console.log("Token deployed to", await token.getAddress());

  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(await token.getAddress(), 30);
  await dao.waitForDeployment();
  console.log("DAO deployed to", await dao.getAddress());

  // grant snapshot role to dao
  const SNAPSHOT_ROLE = await token.SNAPSHOT_ROLE();
  await token.grantRole(SNAPSHOT_ROLE, await dao.getAddress());
  console.log("Granted snapshot role to DAO");

  // 👇 --- ADDED: DEPLOY MOCK TARGET --- 👇
  const MockTarget = await ethers.getContractFactory("MockTarget");
  const target = await MockTarget.deploy();
  await target.waitForDeployment();
  console.log("MockTarget deployed to", await target.getAddress());
  // 👆 --------------------------------- 👆
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });