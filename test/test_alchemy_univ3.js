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
describe("Test Alchemy Functions", function () {
  // variable to store the deployed smart contract
  let governorAlphaImplementation;
  let alchemyImplementation;
  let timelockImplementation;
  let alchemyFactory;
  let stakingRewards;
  let alchemyRouter;
  let alc;
  let mockTokenContract;
  let nonfungiblePositionManagerContract;

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
      gasPrice: ethers.utils.parseUnits("20", "gwei")
    };

  // initial deployment of Conjure Factory
  before(async function () {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    console.log(owner.address);


    let governorAlphaFactory = await ethers.getContractFactory("GovernorAlpha");
    let alchemyFactoryF = await ethers.getContractFactory("Alchemy");
    let timelockFactory = await ethers.getContractFactory("Timelock");
    let mockTokenFactory = await ethers.getContractFactory("MockToken");

    governorAlphaImplementation = await governorAlphaFactory.deploy();
    alchemyImplementation = await alchemyFactoryF.deploy();
    timelockImplementation = await timelockFactory.deploy();

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

    // deploy alc token
    let alcf = await ethers.getContractFactory("ALCH");
    alc = await alcf.deploy(owner.address, owner.address, Date.now());

    // deploy alchemy factory
    let alchemyFactoryFactory = await ethers.getContractFactory(
      "AlchemyFactory"
    );
    alchemyFactory = await alchemyFactoryFactory.deploy(
      alchemyImplementation.address,
      governorAlphaImplementation.address,
      timelockImplementation.address,
      owner.address
    );

    // deploy staking rewards
    let stakingRewardsFactory = await ethers.getContractFactory(
      "StakingRewards"
    );
    stakingRewards = await stakingRewardsFactory.deploy(
      owner.address,
      owner.address,
      alc.address
    );

    // deploy router
    let alchemyRouterFactory = await ethers.getContractFactory("AlchemyRouter");
    alchemyRouter = await alchemyRouterFactory.deploy(
      stakingRewards.address,
      owner.address
    );

    // deploy minty
    let mintyFactory = await ethers.getContractFactory("Minty");
    minty = await mintyFactory.deploy(
      "MIN",
      "TY",
      "www.example.com",
      owner.address
    );
  });

  describe("Implementations locked", () => {
    it("Alchemy", async () => {
      expect(await alchemyImplementation._factoryContract()).to.eq(
        `0x${"00".repeat(19)}01`
      );
    });

    it("GovernorAlpha", async () => {
      expect(await governorAlphaImplementation.nft()).to.eq(
        `0x${"00".repeat(19)}01`
      );
    });

    it("Timelock", async () => {
      expect(await timelockImplementation.admin()).to.eq(
        `0x${"00".repeat(19)}01`
      );
    });
  });



  it("Set up staking distribution", async function () {
    await stakingRewards.setRewardsDistribution(alchemyRouter.address), overrides;
  });

  it("Set up factory owner", async function () {
    //await alchemyFactory.newFactoryOwner(alchemyRouter.address);
    await alchemyFactory.newAlchemyRouter(alchemyRouter.address, overrides);
  });

  it("Enter staking pool", async function () {
    await alc.approve(stakingRewards.address, "50000000000000000000", overrides);
    await stakingRewards.stake("50000000000000000000", overrides);
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

    let alchemy, governor, timelock;

    it("Should deploy alchemy contract", async () => {
      const txmtx = await mockTokenContract.transferNFT(overrides);

      var { events , cumulativeGasUsed, gasUsed} = await txmtx.wait();

      let argumentTokenId = events.find(({event}) => event == 'NFTTOKENID').args;


      let tokenIdInput = argumentTokenId[0].toNumber();


      await nonfungiblePositionManagerContract.approve(
        alchemyFactory.address,
        tokenIdInput,
        overrides
      );

      const tx = await alchemyFactory.NFTDAOMint(
        ["0xc36442b4a4522e871399cd717abdd847ab11fe88"], // is constant on all networks
        owner.address,
        [argumentTokenId[0].toNumber()],
        1,
        "Uniswap V3 Positions NFT V1",
        "UNI-V3-POS",
        "10",
        1,
        0,
        overrides
      );

      var {events, cumulativeGasUsed, gasUsed}  = await tx.wait();

      console.log(`Cumulative: ${cumulativeGasUsed.toNumber()}`);
      console.log(`Gas: ${gasUsed.toNumber()}`);
      const [event] = events.filter((e) => e.event === "NewAlchemy");
      alchemy = await ethers.getContractAt("Alchemy", event.args.alchemy);
      await alchemy.initializeNonfungiblePosition();
      governor = await ethers.getContractAt(
        "GovernorAlpha",
        event.args.governor
      );
      timelock = await ethers.getContractAt("Timelock", event.args.timelock);
    });

    it("Alchemy should have correct params", async () => {
      expect(await alchemy._governor()).to.eq(governor.address);
      expect(await alchemy._timelock()).to.eq(timelock.address);
      expect(await alchemy._buyoutPrice()).to.eq("10");
      expect(await alchemy.name()).to.eq("Uniswap V3 Positions NFT V1");
      expect(await alchemy.symbol()).to.eq("UNI-V3-POS");
    });

    it("Governor should have correct params", async () => {
      expect(await governor.nft()).to.eq(alchemy.address);
      expect(await governor.timelock()).to.eq(timelock.address);
      expect(await governor.totalSupply()).to.eq(1);
      expect(await governor.votingPeriod()).to.eq(1);
    });

    it("Timelock should have correct params", async () => {
      expect(await timelock.admin()).to.eq(governor.address);
      expect(await timelock.delay()).to.eq(0);
    });

    it("Delegate votes", async function () {
      await alchemy.delegate(owner.address);
    });

    it("should approve weth9", async function() {

     await expect(await WETH9Contract.approve(
        alchemy.address,
        ethers.utils.parseEther("1"),
        overrides
      )).to.emit(WETH9Contract, 'Approval').withArgs(owner.address, alchemy.address, ethers.utils.parseEther("1"));

    });

    it("should approve mockToken", async function() {

      await expect(await mockTokenContract.approve(
        alchemy.address,
        ethers.utils.parseEther("10"),
        overrides
      )).to.emit(mockTokenContract, 'Approval').withArgs(owner.address, alchemy.address, ethers.utils.parseEther("10"));

    });

    // test univ3
    it("DAO Univ3 Functions test", async () => {
      await alchemy.quoteLiquidityAddition(
        ethers.utils.parseEther("0.001"),
        ethers.utils.parseEther("0.1"),
        ethers.utils.parseEther("0"),
        ethers.utils.parseEther("0"),
        overrides
      );
    });


  });
});
