const { expect } = require("chai");
const { ethers, waffle, tenderly} = require("hardhat");
const provider = waffle.provider;
const chalk = require("chalk");

describe("Test MockToken", function () {
  //factory
  let mockTokenFactory;

  //contract
  let mockTokenContract;

  // wallet
  let deployingWallet;

  let extraGasInfo;

  let overrides = {
    gasLimit: ethers.utils.parseUnits("7800000", "wei"),
    gasPrice: ethers.utils.parseUnits("3", "gwei"),
  };

  before(async function () {
    [deployingWallet] = await ethers.getSigners();

    mockTokenFactory = await ethers.getContractFactory("MockToken");

    mockTokenContract = await mockTokenFactory.deploy(
      ethers.utils.parseEther("5000"),
      ethers.utils.parseEther("500"),
      overrides
    );

    const gasUsed = mockTokenContract.deployTransaction.gasLimit.mul(
      mockTokenContract.deployTransaction.gasPrice
    );

    extraGasInfo = `${ethers.utils.formatEther(gasUsed)} ETH, tx hash ${
      mockTokenContract.deployTransaction.hash
    }, \n`;

    console.log(
      chalk.cyan("MockToken"),
      "deployed to:",
      chalk.magenta(mockTokenContract.address)
    );

    console.log(chalk.grey(extraGasInfo));

    WETH9Contract = await ethers.getContractAt(
      "IWETH9",
      "0xc778417E063141139Fce010982780140Aa0cD5Ab"
    );

  });

  describe("SelfDeployPool() && mintNonfungibleLiquidityPosition()", () => {

    let deploTX;
    let deploReceipt;

    it("Should deploy the pool", async () => {

      await expect(
        (deploTX = await mockTokenContract.selfDeployPool(
          ethers.utils.parseUnits("31", "wei"),
          ethers.utils.parseUnits("10000", "wei"),
          overrides
        ))
      ).to.emit(mockTokenContract, "PoolInitialized");

    });

    it("Should mint a nonfungible liquidity position", async () => {

      await WETH9Contract.approve(
        mockTokenContract.address,
        ethers.utils.parseEther("1"),
        overrides
      );

      //await WETH9Contract.transferFrom(deployingWallet.address, mockTokenContract.address, ethers.utils.parseEther("0.01"), overrides);
      await mockTokenContract.mintNonfungibleLiquidityPosition(
        ethers.utils.parseEther("0.05"),
        ethers.utils.parseEther("5"),
        ethers.utils.parseEther("0"),
        ethers.utils.parseEther("0"),
        ethers.utils.parseUnits("50000", "wei"),
        ethers.utils.parseUnits("75000", "wei"),
        overrides
      );

    });
  });
});
