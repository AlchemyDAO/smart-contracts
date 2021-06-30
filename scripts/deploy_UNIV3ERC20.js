require("@nomiclabs/hardhat-etherscan");
const { ethers } = require("hardhat");

/// Deployment for doing tests by yourself, usually would be done over factory

async function main() {

	let univ3erc20Factory = await ethers.getContractFactory("contracts/for-verification/UNIV3ERC20.sol:UNIV3ERC20");
	let univ3erc20Contract = await univ3erc20Factory.deploy();
	await univ3erc20Contract.deployed();

	console.log("UNIV3ERC20 deployed to: ", univ3erc20Contract.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });