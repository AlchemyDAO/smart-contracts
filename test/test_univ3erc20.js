// imports
const { defaultAbiCoder } = require("@ethersproject/abi");
const testcases = require("@ethersproject/testcases");
const { expect, should } = require("chai");
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
  let signerArray;
  let testseed =
    "0x01f5bced59dec48e362f2c45b5de68b9fd6c92c6634f44d6d40aab69056506f0e35524a518034ddc1192e1deefacd32c1ed3e231231238ed8e7e54c49a5d0998";
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
    signerArray = [owner, addr1, addr2, addr3, addr4];

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

    it("should pass the following single-depositor tests", async function () {
      let BalanceOne = await univ3erc20.balanceOf(owner.address);

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
        owner.address,
        overrides
      );

      var { events } = await firstadd.wait();
      let newLiquidity = events.find(
        ({ event }) => event == "portionOfLiquidityAdded"
      ).args.newLiquidity;

      let BalanceTwo = await univ3erc20.balanceOf(owner.address);

      expect(BalanceOne.add(newLiquidity)).to.equal(BalanceTwo);

      console.log(
        "BalanceOne ( ",
        BalanceOne.toString(),
        " ) + newLiquidity ( ",
        newLiquidity.toString(),
        " ) = BalanceTwo ( ",
        BalanceTwo.toString(),
        " )"
      );

      const firstrem = await univ3erc20._withdrawPortionOfCurrentLiquidity(
        ethers.utils.parseUnits(BalanceTwo.toString(), "wei"),
        ethers.utils.parseEther("0"),
        ethers.utils.parseEther("0"),
        owner.address,
        overrides
      );

      var { events } = await firstrem.wait();
      let withdrawArgs = events.find(
        ({ event }) => event == "portionOfLiquidityWithdrawn"
      ).args;

      console.log(
        "Amount of liq withdrawn: ",
        withdrawArgs.sharesBurned.toString(),
        "Amount of token0 collected: ",
        withdrawArgs.amount0Collected.toString(),
        "Amount of token1 collected: ",
        withdrawArgs.amount1Collected.toString()
      );

      console.log("Liquidity should be null: \n");
      let liqzero = await univ3erc20.getTotalShares();
      expect(liqzero).to.equal(0);
      console.log(liqzero.toString(), "And it is!\n");

      let BalanceThree = await univ3erc20.balanceOf(owner.address);
      console.log("Balance should be zero now...: \n");
      expect(BalanceThree).to.equal(0);
      console.log(BalanceThree.toString(), "And it is!");

      let suppzero = await univ3erc20.totalSupply();
      console.log("Supply should be zero now...: \n");
      expect(suppzero).to.equal(0);
      console.log(suppzero.toString(), "And it is!");
    });

    it("should pass the following multi-depositor tests: ", async function () {
      let contractArray = [];

      for (index in signerArray) {
        contractArray[index] = [];
        contractArray[index][0] = await univ3erc20.connect(signerArray[index]);
        contractArray[index][1] = await mockTokenContract.connect(
          signerArray[index]
        );
        contractArray[index][2] = await WETH9Contract.connect(
          signerArray[index]
        );
      }

      let compareResult;

      for (index in signerArray) {
        compareResult = await signerArray[index].getBalance();
        if (compareResult.lt(ethers.utils.parseEther("0.4")) && index != 0) {
          const tx = {
            to: signerArray[index].address,
            value: ethers.utils.parseEther("0.4").sub(compareResult),
          };

          const txresp = await owner.sendTransaction(tx);
          await txresp.wait();
        }
      }

      let positionInputTable = {};
      function tokenInputs(mock, weth) {
        this.mock = mock;
        this.weth = weth;
      }

      for (index in signerArray) {
        if (index != 0) {
          let inputMock = ethers.utils.parseEther(
            `${testcases.randomNumber(testseed, 0.2, 0.9)}`
          );
          let inputWeth = ethers.utils.parseEther(
            `${testcases.randomNumber(testseed, 0.001, 0.007)}`
          );

          if (!result) {
            let inputMed = inputMock;
            inputWeth = inputMock;
            inputMock = inputMed;
          }

          positionInputTable[signerArray[index].address] = new tokenInputs(
            inputMock,
            inputWeth
          );

          await mockTokenContract.approve(
            signerArray[index].address,
            inputMock
          );
          await WETH9Contract.approve(signerArray[index].address, inputWeth);

          await mockTokenContract.transfer(
            signerArray[index].address,
            inputMock
          );
          await WETH9Contract.transfer(signerArray[index].address, inputWeth);
        }
      }

      function addMinimums(mmock, mweth, self) {
        this.mock = self.mock;
        this.weth = self.weth;
        this.mmock = mmock;
        this.mweth = mweth;
      }

      let addedInputTable = {};
      let balances = {};

      function addAddedAmounts(amock, aweth) {
        this.amock = amock;
        this.aweth = aweth;
      }
      function writeDownFirstBalance(firstBalance) {
        this.firstBalance = firstBalance;
      }

      for (index in signerArray) {
        if (index != 0) {
          positionInputTable[signerArray[index].address] = new addMinimums(
            positionInputTable[signerArray[index].address].mock
              .div(
                BigNumber.from(`${testcases.randomNumber(testseed, 37, 49)}`)
              )
              .mul(BigNumber.from("10")),
            positionInputTable[signerArray[index].address].weth
              .div(
                BigNumber.from(`${testcases.randomNumber(testseed, 37, 49)}`)
              )
              .mul(BigNumber.from("10")),
            positionInputTable[signerArray[index].address]
          );

          await contractArray[index][1].approve(
            contractArray[index][0].address,
            positionInputTable[signerArray[index].address].mock
          );
          await contractArray[index][2].approve(
            contractArray[index][0].address,
            positionInputTable[signerArray[index].address].weth
          );

          const addtx = await contractArray[
            index
          ][0]._addPortionOfCurrentLiquidity(
            positionInputTable[signerArray[index].address].mock,
            positionInputTable[signerArray[index].address].weth,
            ethers.utils.parseEther("0"), //positionInputTable[signerArray[index].address].mmock,
            ethers.utils.parseEther("0"), //positionInputTable[signerArray[index].address].mweth,
            signerArray[index].address,
            overrides
          );

          const { events } = await addtx.wait();

          let additionArgs = events.find(
            ({ event }) => event == "portionOfLiquidityAdded"
          ).args;

          addedInputTable[signerArray[index].address] = result
            ? new addAddedAmounts(
                additionArgs.amount0Added,
                additionArgs.amount1Added
              )
            : new addAddedAmounts(
                additionArgs.amount1Added,
                additionArgs.amount0Added
              );

          balances[signerArray[index].address] = new writeDownFirstBalance(
            await contractArray[index][0].balanceOf(signerArray[index].address)
          );
        }
      }

      function writeSecondBalance(secondBalance, self) {
        this.firstBalance = self.firstBalance;
        this.secondBalance = secondBalance;
      }

      for (index in signerArray) {
        if (index > 1) {
          let transactedAmount = balances[
            signerArray[index].address
          ].firstBalance.div(
            BigNumber.from(`${testcases.randomNumber(testseed, 10, 14)}`)
          );

          await contractArray[index][0].approve(
            signerArray[index - 1].address,
            transactedAmount
          );
          const trftx = await contractArray[index][0].transfer(
            signerArray[index - 1].address,
            transactedAmount
          );

          await trftx.wait(6);

          let newBalance = await contractArray[index][0].balanceOf(
            signerArray[index].address
          );

          expect(newBalance).to.equal(
            balances[signerArray[index].address].firstBalance.sub(
              transactedAmount
            )
          );

          balances[signerArray[index].address] = new writeSecondBalance(
            newBalance,
            balances[signerArray[index].address]
          );
        }
      }

      balances[signerArray[1].address] = new writeSecondBalance(
        await contractArray[1][0].balanceOf(signerArray[1].address),
        balances[signerArray[1].address]
      );

      let withdrawnTable = {};
      function addWithdrawnAmounts(mock, weth) {
        this.mock = mock;
        this.weth = weth;
      }

      for (index in signerArray) {
        if (index != 0) {
          const wittx = await contractArray[
            index
          ][0]._withdrawPortionOfCurrentLiquidity(
            balances[signerArray[index].address].secondBalance,
            ethers.utils.parseEther("0"),
            ethers.utils.parseEther("0"),
            signerArray[index].address,
            overrides
          );

          const { events } = await wittx.wait();

          let withdrawalArgs = events.find(
            ({ event }) => event == "portionOfLiquidityWithdrawn"
          ).args;

          withdrawnTable[signerArray[index].address] = result
            ? new addWithdrawnAmounts(
                withdrawalArgs.amount0Collected,
                withdrawalArgs.amount1Collected
              )
            : new addWithdrawnAmounts(
                withdrawalArgs.amount1Collected,
                withdrawalArgs.amount0Collected
              );

          let shouldBeZero = await contractArray[index][0].balanceOf(
            signerArray[index].address
          );
        }
      }

      for (index in signerArray) {
        if (index != 0) {
          let balanceMock = await contractArray[index][1].balanceOf(
            signerArray[index].address
          );
          let balanceWeth = await contractArray[index][2].balanceOf(
            signerArray[index].address
          );
          await contractArray[index][1].approve(owner.address, balanceMock);
          await contractArray[index][2].approve(owner.address, balanceWeth);
          await contractArray[index][1].transfer(owner.address, balanceMock);
          await contractArray[index][2].transfer(owner.address, balanceWeth);
        }
      }

      for (index in signerArray) {
        if (index != 0) {
          positionInputTable[signerArray[index].address].mock =
            positionInputTable[signerArray[index].address].mock.toString();
          positionInputTable[signerArray[index].address].mmock =
            positionInputTable[signerArray[index].address].mmock.toString();
          positionInputTable[signerArray[index].address].weth =
            positionInputTable[signerArray[index].address].weth.toString();
          positionInputTable[signerArray[index].address].mweth =
            positionInputTable[signerArray[index].address].mweth.toString();
          addedInputTable[signerArray[index].address].amock =
            addedInputTable[signerArray[index].address].amock.toString();
          addedInputTable[signerArray[index].address].aweth =
            addedInputTable[signerArray[index].address].aweth.toString();
          balances[signerArray[index].address].firstBalance =
            balances[signerArray[index].address].firstBalance.toString();
          balances[signerArray[index].address].secondBalance =
            balances[signerArray[index].address].secondBalance.toString();
          withdrawnTable[signerArray[index].address].mock =
            withdrawnTable[signerArray[index].address].mock.toString();
          withdrawnTable[signerArray[index].address].weth =
            withdrawnTable[signerArray[index].address].weth.toString();
        }
      }

      console.table(positionInputTable);
      console.table(addedInputTable);
      console.table(balances);
      console.table(withdrawnTable);
    });
  });
});
