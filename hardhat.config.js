require("@nomiclabs/hardhat-waffle");
require("dotenv").config();
require("@tenderly/hardhat-tenderly");
require("@nomiclabs/hardhat-etherscan");
// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    hardhat: {
      loggingEnabled: false,
      gas: 4712388,
      gasPrice: 100000,
      blockGasLimit: 2000000000000000,
      forking: {
        url: process.env.ropstenInfura
      }
    },
    ropsten: {
      url: process.env.ropstenInfura,
      accounts: [
        process.env.ropstenWalletPK,
        process.env.ropstenTestWallet1,
        process.env.ropstenTestWallet2,
        process.env.ropstenTestWallet3,
        process.env.ropstenTestWallet4,
        process.env.ropstenTestWallet5
      ],
      timeout: 2147483647,
    },
    rinkeby: {
      url: process.env.rinkebyInfura,
      accounts: [
        process.env.rinkebyWalletPK,
        process.env.rinkebyTestWallet1,
        process.env.rinkebyTestWallet2,
        process.env.rinkebyTestWallet3,
        process.env.rinkebyTestWallet4,
        process.env.rinkebyTestWallet5
      ],
      timeout: 2147483647,
    },
  },

  solidity: {
    compilers: [
      {
        version: "0.5.17",
      },
      {
        version: "0.4.18",
      },
      {
        version: "0.6.5",
        settings: {},
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  mocha: { timeout: 99999999 },
  // this is absolute garbage and doesn't work
  tenderly: {
    project: "spamfest",
    username: "defri",
  },
  etherscan: {
    apiKey: process.env.etherscanAPIKey,
  },
};
