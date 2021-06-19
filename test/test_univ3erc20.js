// imports
const { defaultAbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { waffle } = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";
const { BigNumber } = require("@ethersproject/bignumber");
const provider = waffle.provider;

const encoder = defaultAbiCoder;

// test suite for Alchemy
describe("Test univ3erc20 Functions", function () {

  // variable to store the deployed smart contract
  let alchemyImplementation;
  let alchemyFactory;
  let mockTokenContract;
  let nonfungiblePositionManagerContract;

  let timeout = new Promise((resolve, reject) => {
    setTimeout(() => resolve("done!"), 10000)
  });


  let owner, addr1, addr2, addr3, addr4;
  // const deploy = async (name, ...args) =>
  //   (await ethers.getContractFactory(name)).deploy(...args);

  it("CloneLibrary works", async () => {
    let CloneTestFactory = await ethers.getContractFactory("TestClone");
    let CloneTestContract = await CloneTestFactory.deploy();
    await CloneTestContract.deployed();
  });

  let overrides = {
    gasLimit: ethers.utils.parseUnits("7800000", "wei"),
    gasPrice: ethers.utils.parseUnits("30", "gwei"),
  };

  // initial deployment of Conjure Factory
  before(async function () {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    console.log(owner.address);

    let univ3erc20Factory = await ethers.getContractFactory("UNIV3ERC20");
    let mockTokenFactory = await ethers.getContractFactory("MockToken");

    univ3erc20Implementation = await univ3erc20Factory.deploy();

    mockTokenContract = await mockTokenFactory.deploy(
      ethers.utils.parseEther("5000"),
      ethers.utils.parseEther("500"),
      overrides
    );

    WETH9Contract = await ethers.getContractAt(
      "@uniswap/v3-periphery/contracts/interfaces/external/IWETH9.sol:IWETH9",
      "0xc778417E063141139Fce010982780140Aa0cD5Ab"
    );

    nonfungiblePositionManagerContract = await ethers.getContractAt(
      "NonfungiblePositionManager",
      "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
    );

    // deploy alchemy factory
    let alchemyFactoryFactory = await ethers.getContractFactory(
      "AlchemyFactory"
    );

    alchemyFactory = await alchemyFactoryFactory.deploy(
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      univ3erc20Implementation.address,
      owner.address
    );

 });

  describe("NFTDaoMint()", async () => {
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
        ethers.utils.parseEther("0.03"),
        ethers.utils.parseEther("3"),
        ethers.utils.parseEther("0"),
        ethers.utils.parseEther("0"),
        ethers.utils.parseUnits("50000", "wei"),
        ethers.utils.parseUnits("75000", "wei"),
        overrides
      );
    });

    let univ3erc20;

    it("UNIV3ERC20Mint()", async () => {
      const txmtx = await mockTokenContract.transferNFT(overrides);

      var { events, cumulativeGasUsed, gasUsed } = await txmtx.wait();

      let argumentTokenId = events.find(
        ({ event }) => event == "NFTTOKENID"
      ).args;

      let tokenIdInput = argumentTokenId[0].toNumber();

      console.log("TOKEN ID INPUT: ", tokenIdInput, "\n");

      await nonfungiblePositionManagerContract.approve(
        alchemyFactory.address,
        tokenIdInput,
        overrides
      );

      const tx = await alchemyFactory.UNIV3ERC20Mint(
        "0xc36442b4a4522e871399cd717abdd847ab11fe88", // is constant on all networks
        owner.address,
        tokenIdInput,
        "Uniswap V3 Positions NFT V1",
        "UNI-V3-POS",
        alchemyFactory.address,
        overrides
      );

      var { events, cumulativeGasUsed, gasUsed } = await tx.wait();

      console.log(`Cumulative: ${cumulativeGasUsed.toNumber()}`);
      console.log(`Gas: ${gasUsed.toNumber()}`);
      const [event] = events.filter((e) => e.event === "NewUNIV3ERC20");
      univ3erc20 = await ethers.getContractAt("UNIV3ERC20", event.args.univ3erc20);
      await univ3erc20.initializeNonfungiblePosition();

    });

    it("Alchemy should have correct params", async () => {
      expect(await univ3erc20.name()).to.eq("Uniswap V3 Positions NFT V1");
      expect(await univ3erc20.symbol()).to.eq("UNI-V3-POS");
    });

    it("should approve weth9", async function () {
      await expect(
        await WETH9Contract.approve(
          univ3erc20.address,
          ethers.utils.parseEther("1"),
          overrides
        )
      )
        .to.emit(WETH9Contract, "Approval")
        .withArgs(owner.address, univ3erc20.address, ethers.utils.parseEther("1"));
    });

    it("should approve mockToken", async function () {
      await expect(
        await mockTokenContract.approve(
          univ3erc20.address,
          ethers.utils.parseEther("10"),
          overrides
        )
      )
        .to.emit(mockTokenContract, "Approval")
        .withArgs(
          owner.address,
          univ3erc20.address,
          ethers.utils.parseEther("10")
        );
    });

    // test univ3
    it("DAO Univ3 Functions test", async () => {
      await univ3erc20.quoteLiquidityAddition(
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.1"),
        ethers.utils.parseEther("0"),
        ethers.utils.parseEther("0"),
        overrides
      );
    });
  });
});
