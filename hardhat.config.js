require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("solidity-coverage");

module.exports = {
  solidity: "0.8.19",
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    showTimeSpent: true,
  },
  mocha: {
    timeout: 200000,
  },
};
