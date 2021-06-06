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

    before(async function () {

        [deployingWallet] = await ethers.getSigners();

        mockTokenFactory = await ethers.getContractFactory('MockToken');

        mockTokenContract = await mockTokenFactory.deploy();




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


    });

    describe("SelfDeployPool()", () => {

        let deploTX;
        let deploReceipt;

        it("Should deploy the pool", async () => {

            await expect (deploTX = await mockTokenContract.selfDeployPool()).to.emit(mockTokenContract, 'PoolInitialized');
            deploReceipt = await deploTX.wait();


            console.log(deploReceipt.logs);


        });



    });


});
