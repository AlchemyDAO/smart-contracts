require("@nomiclabs/hardhat-etherscan");
const hre = require("hardhat");

async function main() {
    // We get the contract to deploy

    const Alchemy = await ethers.getContractFactory("AlchemyFactory");
    const alchemy = await Alchemy.deploy("");
    await alchemy.deployed();
    console.log("Alchemy deployed to:", alchemy.address);

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
