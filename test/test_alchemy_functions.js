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
    let alchemyFactory;
    let governorFactory;
    let timelockFactory;
    let stakingRewards;
    let alchemyRouter;
    let alc;
    let minty;
    let alchemy;

    let owner, addr1, addr2, addr3, addr4;

    // initial deployment of Conjure Factory
    before(async function () {
        [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

        const GOVERNOR_ALPHA = await ethers.getContractFactory("GovernorAlpha");
        governorAlphaImplementation = await GOVERNOR_ALPHA.deploy();
        await governorAlphaImplementation.deployed();

        // deploy alc token
        const ALC = await ethers.getContractFactory("ALCH");
        alc = await ALC.deploy(owner.address, owner.address, Date.now());
        await alc.deployed();

        const ALCHEMY_IMPLEMENTATION = await ethers.getContractFactory("Alchemy");
        alchemyImplementation = await ALCHEMY_IMPLEMENTATION.deploy(true);
        await alchemyImplementation.deployed();

        // deploy alchemy factory
        const ALCHEMY = await ethers.getContractFactory("AlchemyFactory");
        alchemyFactory = await ALCHEMY.deploy(alc.address, alchemyImplementation.address);
        await alchemyFactory.deployed();

        // deploy timelock
        const TIMELOCK = await ethers.getContractFactory("TimelockFactory");
        timelockFactory = await TIMELOCK.deploy();
        await timelockFactory.deployed();

        // deploy governor
        const GOVERNOR = await ethers.getContractFactory("GovernorAlphaFactory");
        governorFactory = await GOVERNOR.deploy(governorAlphaImplementation.address);
        await governorFactory.deployed();

        // deploy staking rewards
        const STAKING = await ethers.getContractFactory("StakingRewards");
        stakingRewards = await STAKING.deploy(owner.address, owner.address, alc.address);
        await stakingRewards.deployed();

        // deploy router
        const ROUTER = await ethers.getContractFactory("AlchemyRouter");
        alchemyRouter = await ROUTER.deploy(stakingRewards.address, owner.address, alchemyFactory.address);
        await alchemyRouter.deployed();

        // deploy minty
        const MINTY = await ethers.getContractFactory("Minty");
        minty = await MINTY.deploy(
            "MIN",
            "TY",
            "www.example.com",
            owner.address
        );
        await minty.deployed();

        // deploy minty
        const ALCHEMYCON = await ethers.getContractFactory("Alchemy");
        alchemy = await ALCHEMYCON.deploy(false);
        await alchemy.initializeProxy(
          minty.address,
          owner.address,
          0,
          1000000,
          "TEST",
          "CASE",
          "1000000000000000000",
          alchemyFactory.address
        )
        await alchemy.deployed();
    })

    it("Should be deployed", async function () {
        const name = await alchemy.name();
        expect (name).to.be.equal("TEST");
    });

    it("Should approve erc721 token for transfer", async function () {
        await minty.approve(alchemy.address,0);
    });

    it("Should init", async function () {
        let gov = await alchemy._governor();
        expect (gov).to.be.equal(zeroaddress);

        await alchemy.init(
            governorFactory.address,
            5,
            timelockFactory.address,
            0
        );

        gov = await alchemy._governor();
        expect (gov).to.not.be.equal(zeroaddress);
    });

    it("Set up staking distribution", async function () {
        await stakingRewards.setRewardsDistribution(alchemyRouter.address);
    });

    it("Set up factory owner", async function () {
        await alchemyFactory.newFactoryOwner(alchemyRouter.address);
    });

    it("Enter staking pool", async function () {
        await alc.approve(stakingRewards.address, "50000000000000000000");
        await stakingRewards.stake("50000000000000000000");
    });


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

        await govcontract.propose(
            [alchemy.address],
            [0],
            ["mintSharesForSale(uint256)"],
            [parameters],
            "Test proposal to increase shares for sale"
        );

        console.log(await provider.getBlockNumber())
        console.log(await govcontract.state(1))

        await ethers.provider.send("evm_mine")      // mine the next block

        console.log(await provider.getBlockNumber())
        console.log(await govcontract.state(1))

        await govcontract.castVote(1, true);

        await ethers.provider.send("evm_increaseTime", [60*60*5])
        await ethers.provider.send("evm_mine")      // mine the next block
        await ethers.provider.send("evm_mine")      // mine the next block
        await ethers.provider.send("evm_mine")      // mine the next block
        await ethers.provider.send("evm_mine")      // mine the next block
        await ethers.provider.send("evm_mine")      // mine the next block



        console.log(await govcontract.state(1))
        console.log(await ethers.provider.getBlockNumber())
        console.log(await govcontract.proposals(1))
        await govcontract.queue(1)

        await ethers.provider.send("evm_mine")      // mine the next block


        let shares = await alchemy._sharesForSale()
        expect (shares).to.be.equal(0)

        await govcontract.execute(1)

        shares = await alchemy._sharesForSale()
        expect (shares).to.be.equal("1000000000000000000")
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

        shares = await alchemy._nftCount()
        expect (shares).to.be.equal(2)
    });

    it("Should be possible to make a proposal to buy a specific nft", async function () {

        const goveroraddress = await alchemy._governor();
        const govcontract = await ethers.getContractAt("GovernorAlpha", goveroraddress);

        // send 1 eth
        let overrides = {
            value: "3000000000000000000"
        };

        await expect(alchemy.buySingleNft(2, overrides)).to.be.reverted;

        let parameters = encoder.encode(
            ["uint256","uint256","bool"],
            [2, "1000000000000000000", true]
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

        await alchemy.buySingleNft(2, overrides);

        let shares = await alchemy._nftCount()
        expect (shares).to.be.equal(1)
    });

    it("Should be possible to buy shares for sale", async function () {

        let overrides = {
            value: "5000000000000000000"
        };

        let shares = await alchemy._sharesForSale()
        expect (shares).to.be.equal("1000000000000000000")

        await alchemy.Buyshares("500000000000000000", overrides)

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

    it("Should be possible to make a proposal to return the nft", async function () {

        const goveroraddress = await alchemy._governor();
        const govcontract = await ethers.getContractAt("GovernorAlpha", goveroraddress);


        let parameters = encoder.encode(
            [],
            []
        )

        await govcontract.propose(
            [alchemy.address],
            [0],
            ["returnNft()"],
            [parameters],
            "Test proposal to return the nft"
        );


        await ethers.provider.send("evm_mine")      // mine the next block
        await govcontract.castVote(6, true);

        await ethers.provider.send("evm_increaseTime", [60*60*5])
        await ethers.provider.send("evm_mine")      // mine the next block
        await ethers.provider.send("evm_mine")      // mine the next block
        await ethers.provider.send("evm_mine")      // mine the next block
        await ethers.provider.send("evm_mine")      // mine the next block
        await ethers.provider.send("evm_mine")      // mine the next block
        await govcontract.queue(6)

        await ethers.provider.send("evm_mine")      // mine the next block

        await govcontract.execute(6)
    });

    it("Should be possible to buyout", async function () {
        let overrides = {
            value: "5000000000000000000"
        };

        await alchemy.buyout(overrides)

        let ow = await minty.ownerOf(0)
        expect(ow).to.be.equal(owner.address)
    });

    it("Should be possible to burnForETH", async function () {

        await alchemy.burnForETH()

    });

    it("Should not be possible to call a function for TL directly", async function () {
        await expect(alchemy.mintSharesForSale(2)).to.be.reverted;
    });

    it("Should be possible to do a dao mint", async function () {
        await alchemyFactory.NFTDAOMint(
            minty.address,
            owner.address,
            0,
            100,
            "TEST",
            "TOKEN",
            "1000000000000000"
        )
    });



});
