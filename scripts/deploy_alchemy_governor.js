require("@nomiclabs/hardhat-etherscan");
const hre = require("hardhat");

async function main() {
    // We get the contract to deploy

    const GovernorAlpha = await ethers.getContractFactory("GovernorAlphaFactory");
    const factory = await GovernorAlpha.deploy();
    await factory.deployed();
    console.log("GovernorAlpha deployed to:", factory.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
