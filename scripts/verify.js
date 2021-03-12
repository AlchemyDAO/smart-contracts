require("@nomiclabs/hardhat-etherscan");
const hre = require("hardhat");

async function main() {
    // We get the contract to deploy

    await hre.run("verify:verify", {
        address: "",
        constructorArguments: ["", "", 8204800 ]
    })





}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
