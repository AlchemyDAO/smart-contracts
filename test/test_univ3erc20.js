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
  // factories / contracts
  let alchemyFactory;
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

  // due to testnet, we have to specify gas limit, this is almost max on ropsten
  let overrides = {
    gasLimit: ethers.utils.parseUnits("7800000", "wei"),
    gasPrice: ethers.utils.parseUnits("15", "gwei"),
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

    // standard horrible weth9 contract
    WETH9Contract = await ethers.getContractAt(
      "@uniswap/v3-periphery/contracts/interfaces/external/IWETH9.sol:IWETH9",
      "0xc778417E063141139Fce010982780140Aa0cD5Ab"
    );

    // always deployed at same address
    nonfungiblePositionManagerContract = await ethers.getContractAt(
      "NonfungiblePositionManager",
      "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"
    );

    // deploy alchemy factory
    let alchemyFactoryFactory = await ethers.getContractFactory(
      "AlchemyFactory"
    );

    // this iteration of alchemy factory does not need any other implementations other than the one we're testing
    alchemyFactory = await alchemyFactoryFactory.deploy(
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
      univ3erc20Implementation.address,
      "0x0000000000000000000000000000000000000000"
    );
  });

  describe("NFTDaoMint()", async () => {

    // here mock token is deploying the pool immediately
    it("Should deploy the pool", async () => {
      await expect(
        (deploTX = await mockTokenContract.selfDeployPool(
          ethers.utils.parseUnits("31", "wei"),
          ethers.utils.parseUnits("10000", "wei"),
          overrides
        ))
      ).to.emit(mockTokenContract, "PoolInitialized");
    });

    let result;

    // the mock token contract also mints the nonfungible position and adds liquidity which it takes from its own contract / 
    // eth from the caller for the sake of simplicity
    it("Should mint a nonfungible liquidity position", async () => {
      await WETH9Contract.approve(
        mockTokenContract.address,
        ethers.utils.parseEther("1"),
        overrides
      );

      const tadrtx = await mockTokenContract.returnTokenAddresses(overrides);

      var { events } = await tadrtx.wait();

      let argumentToken0 = events.find(({ event }) => event == "TokenAddresses")
        .args.token0;

      console.log("EVENT ARG TOKEN: ", argumentToken0, "\n");

      // check to see which token is actually assigned to 0
      if (argumentToken0 != mockTokenContract.address) {
        result = false;
        await mockTokenContract.mintNonfungibleLiquidityPosition(
          ethers.utils.parseEther("0.001"),
          ethers.utils.parseEther("0.1"),
          ethers.utils.parseEther("0"),
          ethers.utils.parseEther("0"),
          ethers.utils.parseUnits("50000", "wei"),
          ethers.utils.parseUnits("75000", "wei"),
          overrides
        );
      } else {
        result = true;
        await mockTokenContract.mintNonfungibleLiquidityPosition(
          ethers.utils.parseEther("0.1"),
          ethers.utils.parseEther("0.001"),
          ethers.utils.parseEther("0"),
          ethers.utils.parseEther("0"),
          ethers.utils.parseUnits("50000", "wei"),
          ethers.utils.parseUnits("75000", "wei"),
          overrides
        );
      }

      //await WETH9Contract.transferFrom(deployingWallet.address, mockTokenContract.address, ethers.utils.parseEther("0.01"), overrides);
    });

    let univ3erc20, tokenIdInput;

    // lets mint the univ3erc20 contract
    it("UNIV3ERC20Mint()", async () => {

      // transfer NFT from mock to owner and emit NFTTOKENID event
      const txmtx = await mockTokenContract.transferNFT(overrides);

      var { events } = await txmtx.wait();

      // get the token id
      let argumentTokenId = events.find(
        ({ event }) => event == "NFTTOKENID"
      ).args;

      tokenIdInput = argumentTokenId[0].toNumber();

      console.log("TOKEN ID INPUT: ", tokenIdInput, "\n");

      // approve token transferral
      await nonfungiblePositionManagerContract.approve(
        alchemyFactory.address,
        tokenIdInput,
        overrides
      );

      // mint the NFT 
      const tx = await alchemyFactory.UNIV3ERC20Mint(
        nonfungiblePositionManagerContract.address, // is constant on all networks
        owner.address,
        tokenIdInput,
        "Uniswap V3 Positions NFT V1",
        "UNI-V3-POS",
        alchemyFactory.address,
        overrides
      );

      // check the gas
      var { events, cumulativeGasUsed, gasUsed } = await tx.wait();

      console.log(`Cumulative: ${cumulativeGasUsed.toNumber()}`);
      console.log(`Gas: ${gasUsed.toNumber()}`);
      const [event] = events.filter((e) => e.event === "NewUNIV3ERC20");
      univ3erc20 = await ethers.getContractAt(
        "UNIV3ERC20",
        event.args.univ3erc20
      );
    });

    // check unimportant params
    it("Alchemy should have correct params", async () => {
      expect(await univ3erc20.name()).to.eq("Uniswap V3 Positions NFT V1");
      expect(await univ3erc20.symbol()).to.eq("UNI-V3-POS");
    });

    // approve weth9 for spending from owner
    it("should approve weth9", async function () {
      await expect(
        await WETH9Contract.approve(
          univ3erc20.address,
          ethers.utils.parseEther("1"),
          overrides
        )
      )
        .to.emit(WETH9Contract, "Approval")
        .withArgs(
          owner.address,
          univ3erc20.address,
          ethers.utils.parseEther("1")
        );
    });

    // approve mock for spending from owner ( was minted to owner at deployment )
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

    it("should pass the following math tests", async function () {

      let BalanceOne = await univ3erc20.balanceOf(owner.address);
      BalanceOne = BalanceOne.toNumber();

      let position1 = ethers.utils.parseEther("0.3");
      let position2 = ethers.utils.parseEther("0.003");

      if (!result) {
        let positionmed = position2;
        position2 = position1;
        position1 = positionmed;
      }

      const firstadd = await univ3erc20._addPortionOfCurrentLiquidity(
          position1,
          position2,
          ethers.utils.parseEther("0"),
          ethers.utils.parseEther("0"),
          owner.address
      )

      var { events } = await firstadd.wait();
      let newLiquidity = events.find(
        ({ event }) => event == "portionOfLiquidityAdded"
      ).args.newLiquidity;
      newLiquidity = newLiquidity.toNumber();


      let BalanceTwo = await univ3erc20.balanceOf(owner.address);
      BalanceTwo = BalanceTwo.toNumber();
      
      expect((TotalSharesOne + newLiquidity)).to.equal(TotalSharesTwo);
    });
  });
});
