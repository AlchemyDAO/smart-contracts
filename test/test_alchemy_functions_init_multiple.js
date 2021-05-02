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
describe("Test Alchemy Init multiple nfts", function () {

    // variable to store the deployed smart contract
    let governorAlphaImplementation;
    let alchemyImplementation;
    let timelockImplementation;
    let alchemyFactory;
    let stakingRewards;
    let alchemyRouter;
    let alc;
    let minty;
    let minty2;

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

        // deploy minty
        minty2 = await deploy(
            'Minty',
            "MIN2",
            "TY2",
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

      it('Should not deploy with 2nd nft not being approved', async () => {
          await minty.approve(alchemyFactory.address, 0);

          await expect(alchemyFactory.NFTDAOMint(
              [minty.address, minty2.address],
              owner.address,
              [0,0],
              1000000,
              "TEST",
              "CASE",
              "1000000000000000000",
              5,
              0
          )).to.be.reverted;
      })

        it('Should deploy alchemy contract', async () => {
            await minty2.approve(alchemyFactory.address, 0);

            const tx = await alchemyFactory.NFTDAOMint(
                [minty.address, minty2.address],
                owner.address,
                [0,0],
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

        expect(await alchemy._nftCount()).to.eq("2");

       let nft1 = await alchemy._raisedNftArray(0)
          let nft2 = await alchemy._raisedNftArray(1)


          expect(nft1.nftaddress).to.be.equal(minty.address)
          expect(nft1.tokenid).to.be.equal(0)
          expect(nft1.forSale).to.be.equal(false)
          expect(nft1.price).to.be.equal(0)

          expect(nft2.nftaddress).to.be.equal(minty2.address)
          expect(nft2.tokenid).to.be.equal(0)
          expect(nft2.forSale).to.be.equal(false)
          expect(nft2.price).to.be.equal(0)



      })
    })

});
