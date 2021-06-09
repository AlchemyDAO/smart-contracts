const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
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

    console.log(ethers.utils.parseEther("1.0"));

    let overrides = {
        gasLimit: ethers.utils.parseUnits("4000000", "wei"),
        gasPrice: ethers.utils.parseUnits("3", "gwei")
    }



    before(async function () {

        [deployingWallet] = await ethers.getSigners();

        mockTokenFactory = await ethers.getContractFactory('MockToken');

        mockTokenContract = await mockTokenFactory.deploy(overrides);

        const gasUsed = mockTokenContract.deployTransaction.gasLimit.mul(mockTokenContract.deployTransaction.gasPrice)
        extraGasInfo = `${ethers.utils.formatEther(gasUsed)} ETH, tx hash ${mockTokenContract.deployTransaction.hash}, \n`

        console.log(
            chalk.cyan("MockToken"),
            "deployed to:",
            chalk.magenta(mockTokenContract.address)
        );
        console.log(
            chalk.grey(extraGasInfo)
        );

        WETH9Contract = await ethers.getContractAt('IWETH9', '0xc778417E063141139Fce010982780140Aa0cD5Ab');
    });

    describe("SelfDeployPool() && mintNonfungibleLiquidityPosition()", () => {

        let deploTX;
        let deploReceipt;

        it("Should deploy the pool", async () => {

            await expect(deploTX = await mockTokenContract.selfDeployPool()).to.emit(mockTokenContract, 'PoolInitialized');
            deploReceipt = await deploTX.wait();

            console.log(deploReceipt.logs);

        });

        it("Should mint a nonfungible liquidity position", async () => {

            await WETH9Contract.approve(mockTokenContract.address, ethers.utils.parseEther("1"), overrides);


            //await WETH9Contract.transferFrom(deployingWallet.address, mockTokenContract.address, ethers.utils.parseEther("0.01"), overrides);
            await mockTokenContract.mintNonfungibleLiquidityPosition(ethers.utils.parseEther("0.01"), ethers.utils.parseEther("100"), ethers.utils.parseEther("0.00001"), ethers.utils.parseEther("0.000000001"), overrides);


        });







    });


});
