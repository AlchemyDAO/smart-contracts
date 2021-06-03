pragma solidity ^0.7.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IUniswapV3Factory.sol} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol"
import {
    INonfungiblePositionManager
} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import { WETH9 } from "./WETH9.sol";

// testnet ether weth9 0xc778417E063141139Fce010982780140Aa0cD5Ab


contract MockToken is ERC20 {

    bool public poolDeployed;
    IUniswapV3Factory public v3Factory;
    INonfungiblePositionManager public v3NPM;
    WETH9 public weth9c;
    address public poolAddress;


    constructor () ERC20("MockToken", "MOCK2536") {
        poolDeployed = false;
        v3Factory = IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);
        v3NPM = INonfungiblePositionManager(0xC36442b4a4522E871399CD717aBDD847Ab11FE88);
        weth9c = WETH9(0xc778417E063141139Fce010982780140Aa0cD5Ab);
        _mint(address(this), 100000000);
        poolAddress = address(0);
    }

    function selfDeployPool external {
        require(!poolDeployed, "only once");
        poolAddress = v3Factory(address(this), 0xc778417E063141139Fce010982780140Aa0cD5Ab, 1000);
        poolDeployed = true;
    }

    function addWETH external payable {
        address payable weth9cAddress = address(weth9c);
        // has fallback function
        weth9cAddress.send(msg.value);
    }

    function mintNonfungibleLiquidityPosition() {

    }

}