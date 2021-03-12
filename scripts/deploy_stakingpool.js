require("@nomiclabs/hardhat-etherscan");
const hre = require("hardhat");

async function main() {
    // We get the contract to deploy

    const Pool = await ethers.getContractFactory("StakingRewards");
    const pool = await Pool.deploy("", "", "");
    await pool.deployed();
    console.log("Pool deployed to:", pool.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
