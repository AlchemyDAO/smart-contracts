require("@nomiclabs/hardhat-etherscan");
const hre = require("hardhat");

async function main() {
    // We get the contract to deploy


    console.log('ok')
    const ALC = await ethers.getContractFactory("ALC");
    console.log('ok2')
    const alc = await ALC.deploy("", "", "1715468411");
    console.log('ok3')
    await alc.deployed();
    console.log("ALC deployed to:", alc.address);

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
