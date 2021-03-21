require("@nomiclabs/hardhat-waffle");

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
      blockGasLimit: 2000000000000000
    }
  },

  solidity: {
    compilers: [
      {
        version: "0.5.17"
      },
      {
        version: "0.4.18"
      },
      {
        version: "0.6.5",
        settings: { } 
      },
      {
        version: "0.7.6",
        settings: { } 
      }
    ]
  }
};

