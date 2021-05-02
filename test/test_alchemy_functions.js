// imports
const {defaultAbiCoder} = require("@ethersproject/abi");
const {expect} = require("chai");
const { ethers } = require("hardhat");
const {waffle} = require("hardhat");
const zeroaddress = "0x0000000000000000000000000000000000000000";
const {BigNumber} = require('@ethersproject/bignumber');
const provider = waffle.provider;

const encoder = defaultAbiCoder

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
    let minty;

    let owner, addr1, addr2, addr3, addr4;
    const deploy = async (name, ...args) => (await ethers.getContractFactory(name)).deploy(...args);

    it('CloneLibrary works', async () => {
      const test = await deploy('TestClone');
      await test.deployed();
    })

    // initial deployment of Conjure Factory
    before(async function () {
        [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

        governorAlphaImplementation = await deploy('GovernorAlpha');
        alchemyImplementation = await deploy('Alchemy');
        timelockImplementation = await deploy('Timelock');

        // deploy alc token
        alc = await deploy('ALCH', owner.address, owner.address, Date.now());

        // deploy alchemy factory
        alchemyFactory = await deploy(
            'AlchemyFactory',
            alchemyImplementation.address,
            governorAlphaImplementation.address,
            timelockImplementation.address,
            owner.address
        );

        // deploy staking rewards
        stakingRewards = await deploy('StakingRewards', owner.address, owner.address, alc.address);

        // deploy router
        alchemyRouter = await deploy('AlchemyRouter', stakingRewards.address, owner.address);

        // deploy minty
        minty = await deploy(
          'Minty',
          "MIN",
          "TY",
          "www.example.com",
          owner.address
        );
    })

    describe('Implementations locked', () => {
        it('Alchemy', async () => {
            expect(await alchemyImplementation._factoryContract()).to.eq(`0x${'00'.repeat(19)}01`);
        })
        
        it('GovernorAlpha', async () => {
            expect(await governorAlphaImplementation.nft()).to.eq(`0x${'00'.repeat(19)}01`);
        })

        it('Timelock', async () => {
            expect(await timelockImplementation.admin()).to.eq(`0x${'00'.repeat(19)}01`);
        })
    })
    
    it("Set up staking distribution", async function () {
        await stakingRewards.setRewardsDistribution(alchemyRouter.address);
    });

    it("Set up factory owner", async function () {
        //await alchemyFactory.newFactoryOwner(alchemyRouter.address);
        await alchemyFactory.newAlchemyRouter(alchemyRouter.address)
    });

    it("Enter staking pool", async function () {
        await alc.approve(stakingRewards.address, "50000000000000000000");
        await stakingRewards.stake("50000000000000000000");
    });

    describe('NFTDaoMint()', async () => {
      let alchemy, governor, timelock;

      it('Should deploy alchemy contract', async () => {
          await minty.approve(alchemyFactory.address, 0);

          const tx = await alchemyFactory.NFTDAOMint(
              [minty.address],
              owner.address,
              [0],
              1000000,
              "TEST",
              "CASE",
              "1000000000000000000",
              5,
              0
          );
          const { events, cumulativeGasUsed, gasUsed } = await tx.wait();
          console.log(`Cumulative: ${cumulativeGasUsed.toNumber()}`);
          console.log(`Gas: ${gasUsed.toNumber()}`)
          const [event] = events.filter(e => e.event === "NewAlchemy");
          alchemy = await ethers.getContractAt("Alchemy", event.args.alchemy);
          governor = await ethers.getContractAt("GovernorAlpha", event.args.governor);
          timelock = await ethers.getContractAt("Timelock", event.args.timelock);
      })

      it('Alchemy should have correct params', async () => {
        expect(await alchemy._governor()).to.eq(governor.address);
        expect(await alchemy._timelock()).to.eq(timelock.address);
        expect(await alchemy._buyoutPrice()).to.eq("1000000000000000000");
        expect(await alchemy.name()).to.eq("TEST");
        expect(await alchemy.symbol()).to.eq("CASE");
      })

      it('Governor should have correct params', async () => {
        expect(await governor.nft()).to.eq(alchemy.address);
        expect(await governor.timelock()).to.eq(timelock.address);
        expect(await governor.totalSupply()).to.eq(1000000);
        expect(await governor.votingPeriod()).to.eq(5);
      })

      it('Timelock should have correct params', async () => {
        expect(await timelock.admin()).to.eq(governor.address);
        expect(await timelock.delay()).to.eq(0);
      })

      // test proposals
      it("Delegate votes", async function () {
          await ethers.provider.send("evm_mine")      // mine the next block
          await alchemy.delegate(owner.address)
      });
  
      it("Should be possible to make a proposal to increase shares for sale", async function () {
          const goveroraddress = await alchemy._governor();
          const govcontract = await ethers.getContractAt("GovernorAlpha", goveroraddress);
  
          let parameters = encoder.encode(
              ["uint256"],
              ["1000000000000000000"]
          )
  
          await governor.propose(
              [alchemy.address],
              [0],
              ["mintSharesForSale(uint256)"],
              [parameters],
              "Test proposal to increase shares for sale"
          );
  
          await ethers.provider.send("evm_mine")      // mine the next block
  
          await governor.castVote(1, true);
  
          await ethers.provider.send("evm_increaseTime", [60*60*5])
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
  
          await governor.queue(1)
  
          await ethers.provider.send("evm_mine")      // mine the next block
  
  
          let shares = await alchemy._sharesForSale()
          expect (shares).to.be.equal(0)

          let totalsupp = await alchemy.totalSupply()

          await governor.execute(1)


          let totalsuppnew = await alchemy.totalSupply()
          shares = await alchemy._sharesForSale()
          expect (shares).to.be.equal("1000000000000000000")

          expect(BigNumber.from(totalsupp).add(shares)).to.be.equal(totalsuppnew)

      });

      it("Should be possible to make a proposal to increase buyout price", async function () {
          const goveroraddress = await alchemy._governor();
          const govcontract = await ethers.getContractAt("GovernorAlpha", goveroraddress);
  
          let parameters = encoder.encode(
              ["uint256"],
              ["5000000000000000000"]
          )
  
          await govcontract.propose(
              [alchemy.address],
              [0],
              ["changeBuyoutPrice(uint256)"],
              [parameters],
              "Test proposal to increase buyout price"
          );
  
          await ethers.provider.send("evm_mine")      // mine the next block
          await govcontract.castVote(2, true);
  
          await ethers.provider.send("evm_increaseTime", [60*60*5])
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
  
          await govcontract.queue(2)
  
          await ethers.provider.send("evm_mine")      // mine the next block
  
  
          let shares = await alchemy._buyoutPrice()
          expect (shares).to.be.equal("1000000000000000000")
  
          await govcontract.execute(2)
  
          shares = await alchemy._buyoutPrice()
          expect (shares).to.be.equal("5000000000000000000")
      });
  
      it("Should be possible to make a proposal to add a nft", async function () {
  
          const goveroraddress = await alchemy._governor();
          const govcontract = await ethers.getContractAt("GovernorAlpha", goveroraddress);
  
          let parameters = encoder.encode(
              ["address","uint256"],
              [minty.address,1]
          )
  
          await govcontract.propose(
              [alchemy.address],
              [0],
              ["addNft(address,uint256)"],
              [parameters],
              "Test proposal to add nft"
          );
  
          await ethers.provider.send("evm_mine")      // mine the next block
          await govcontract.castVote(3, true);
  
          await ethers.provider.send("evm_increaseTime", [60*60*5])
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
  
          await govcontract.queue(3)
  
          await ethers.provider.send("evm_mine")      // mine the next block
  
  
          let shares = await alchemy._nftCount()
          expect (shares).to.be.equal(1)
  
          await minty.approve(alchemy.address,1);
          await minty.transferFrom(owner.address, alchemy.address,1);
  
          await govcontract.execute(3)

          console.log(await minty.ownerOf(1))
          console.log(alchemy.address)
  
          shares = await alchemy._nftCount()
          expect (shares).to.be.equal(2)
      });
  
      it("Should be possible to make a proposal to buy a specific nft", async function () {
          const goveroraddress = await alchemy._governor();
          const govcontract = await ethers.getContractAt("GovernorAlpha", goveroraddress);
  
          // send 1 eth
          let overrides = {
              value: "1000000000000000000"
          };
  
          await expect(alchemy.buySingleNft(1, overrides)).to.be.reverted;
  
          let parameters = encoder.encode(
              ["uint256","uint256","bool"],
              [1, "1000000000000000000", true]
          )
  
          await govcontract.propose(
              [alchemy.address],
              [0],
              ["setNftSale(uint256,uint256,bool)"],
              [parameters],
              "Test proposal to sell a single nft"
          );
  
          await ethers.provider.send("evm_mine")      // mine the next block
          await govcontract.castVote(4, true);
  
          await ethers.provider.send("evm_increaseTime", [60*60*5])
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
  
          await govcontract.queue(4)
  
          await ethers.provider.send("evm_mine")      // mine the next block
  
  
          await govcontract.execute(4)
  
          await alchemy.buySingleNft(1, overrides);

          console.log(await minty.ownerOf(1))
          console.log(alchemy.address)
  
          let shares = await alchemy._nftCount()
          expect (shares).to.be.equal(1)
      });
  
      it("Should be possible to buy shares for sale", async function () {

          let totalsupply = await alchemy.totalSupply()
          let buyout = await alchemy._buyoutPrice();

          let valuer = BigNumber.from("500000000000000000").mul(buyout).div(totalsupply)

          let overrides = {
              value: valuer
          };

          console.log(valuer)
  
          let shares = await alchemy._sharesForSale()
          expect (shares).to.be.equal("1000000000000000000")


          await alchemy.buyShares("500000000000000000", overrides)



          shares = await alchemy._sharesForSale()
          expect (shares).to.be.equal("500000000000000000")
      });
  
      it("Should be possible to make a proposal to burn shares for sale", async function () {
  
          const goveroraddress = await alchemy._governor();
          const govcontract = await ethers.getContractAt("GovernorAlpha", goveroraddress);
  
  
          let parameters = encoder.encode(
              ["uint256"],
              ["200000000000000000"]
          )
  
          await govcontract.propose(
              [alchemy.address],
              [0],
              ["burnSharesForSale(uint256)"],
              [parameters],
              "Test proposal to burn shares for sale"
          );
  
  
          await ethers.provider.send("evm_mine")      // mine the next block
  
  
          await govcontract.castVote(5, true);
  
          await ethers.provider.send("evm_increaseTime", [60*60*5])
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await ethers.provider.send("evm_mine")      // mine the next block
          await govcontract.queue(5)
  
          await ethers.provider.send("evm_mine")      // mine the next block
  
          await govcontract.execute(5)
  
          let shares = await alchemy._sharesForSale()
          expect (shares).to.be.equal("300000000000000000")
  
      });
  
      it("Should be possible to buyout", async function () {
          let overrides = {
              value: "5000000000000000000"
          };

          console.log(await alchemy._nftCount())
  
          await alchemy.connect(addr1).buyout(overrides)


          expect(await alchemy._buyoutAddress()).to.be.equal(addr1.address)
      });
  
      it("Should be possible to burnForETH", async function () {
  
          await alchemy.burnForETH()
  
      });
  
      it("Should not be possible to call a function for TL directly", async function () {
          await expect(alchemy.mintSharesForSale(2)).to.be.reverted;
      });
    })




});
