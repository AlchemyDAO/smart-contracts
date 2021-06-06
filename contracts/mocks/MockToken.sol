pragma solidity ^0.7.6;
pragma abicoder v2;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {
    IUniswapV3Factory
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {
    INonfungiblePositionManager
} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {
    TransferHelper
} from "@uniswap/v3-core/contracts/libraries/TransferHelper.sol";
import {
    IUniswapV3PoolActions
} from "@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolActions.sol";
import {IWETH9} from "./IWETH9.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

// testnet ether weth9 0xc778417E063141139Fce010982780140Aa0cD5Ab

contract MockToken is ERC20 {
    using TransferHelper for address;
    using SafeMath for uint256;

    address public poolAddress;
    bool public poolDeployed;
    uint256 public tokenId;

    IUniswapV3Factory public v3Factory;
    INonfungiblePositionManager public v3NPM;
    IUniswapV3PoolActions public deployedPool;
    IWETH9 public weth9c;

    event PoolInitialized(address PoolAddress, uint160 sqrtPriceX96);
    event NonfungibleLiquidityPositionMinted(
        uint256 tokenId,
        uint128 liquidity,
        uint256 amountToken0Used,
        uint256 amountToken1Used
    );

    constructor() ERC20("MockToken", "MOCK2536") {
        poolDeployed = false;
        v3Factory = IUniswapV3Factory(
            0x1F98431c8aD98523631AE4a59f267346ea31F984
        );
        v3NPM = INonfungiblePositionManager(
            0xC36442b4a4522E871399CD717aBDD847Ab11FE88
        );
        weth9c = IWETH9(0xc778417E063141139Fce010982780140Aa0cD5Ab);
        _mint(address(this), 100000000);
    }

    function selfDeployPool() external {
        require(!poolDeployed, "only once");
        // deploy pool with 1% fee in hundreths of bip so 0.0001*10000 = 1%

        poolAddress = v3Factory.createPool(
            0xc778417E063141139Fce010982780140Aa0cD5Ab,
            address(this),
            10000
        );
        deployedPool = IUniswapV3PoolActions(poolAddress);

        // ok so the price of the pools:
        // Price is represented as a sqrt(amountToken1/amountToken0) Q64.96 value
        // 0 = weth9, 1 = this so sqrt(this/weth9)
        // sqrt PriceX96 the initial sqrt price of the pool as a Q64.96 // so 64 integer 96 fractional parts
        // we will set 25,000,000 so root 5000

        uint160 sqrtPrice = uint160(5000 << 96);
        deployedPool.initialize(sqrtPrice);
        PoolInitialized(poolAddress, sqrtPrice);
        poolDeployed = true;
    }

    function addWETH() external payable {
        address payable weth9cAddress = payable(address(weth9c));
        // has fallback function
        weth9cAddress.send(msg.value);
    }

    function mintNonfungibleLiquidityPosition(
        uint256 maxAmount0,
        uint256 maxAmount1,
        uint256 minAmount0,
        uint256 minAmount1
    ) external {
        require(
            maxAmount0 < weth9c.balanceOf(address(this)),
            "not enough token0 and possibly token 1"
        );
        require(maxAmount1 < balanceOf(address(this)), "not enough of token1");

        transferFrom(msg.sender, address(this), maxAmount0);
        weth9c.transferFrom(msg.sender, address(this), maxAmount1);

        uint128 liquidity;
        uint256 used0;
        uint256 used1;

        (tokenId, liquidity, used0, used1) = v3NPM.mint(
            INonfungiblePositionManager.MintParams({
                token0: 0xc778417E063141139Fce010982780140Aa0cD5Ab,
                token1: address(this),
                fee: 10000,
                tickLower: 165889,
                tickUpper: 173999,
                amount0Desired: maxAmount0,
                amount1Desired: maxAmount1,
                amount0Min: minAmount0,
                amount1Min: minAmount1,
                recipient: address(this),
                deadline: uint256(block.timestamp).add(1 minutes)
            })
        );

        transfer(msg.sender, maxAmount0.sub(used0));
        weth9c.transferFrom(address(this), msg.sender, maxAmount0.sub(used0));

        emit NonfungibleLiquidityPositionMinted(
            tokenId,
            liquidity,
            used0,
            used1
        );
    }
}
