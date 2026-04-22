async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with", deployer.address);

  const Token = await ethers.getContractFactory("GovernanceToken");
  const token = await Token.deploy(
    "GovToken",
    "GOV",
    ethers.utils.parseEther("1000"),
  );
  await token.deployed();
  console.log("Token deployed to", token.address);

  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(token.address, 30);
  await dao.deployed();
  console.log("DAO deployed to", dao.address);

  // grant snapshot role to dao
  const SNAPSHOT_ROLE = await token.SNAPSHOT_ROLE();
  await token.grantRole(SNAPSHOT_ROLE, dao.address);
  console.log("Granted snapshot role to DAO");
}

module.exports = { main };
