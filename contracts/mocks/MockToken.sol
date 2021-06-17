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
    IUniswapV3Pool
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IWETH9} from "@uniswap/v3-periphery/contracts/interfaces/external/IWETH9.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

// testnet ether weth9 0xc778417E063141139Fce010982780140Aa0cD5Ab

contract MockToken is ERC20 {
    using TransferHelper for address;
    using SafeMath for uint256;
    using SafeMath for uint160;

    bool public poolDeployed;
    uint256 public tokenId;
    uint256 public constant MAX_INT =
        115792089237316195423570985008687907853269984665640564039457584007913129639935;

    IUniswapV3Factory public v3Factory;
    INonfungiblePositionManager public v3NPM;
    IUniswapV3Pool public deployedPool;
    IWETH9 public weth9c;

    event PoolInitialized(address PoolAddress, uint160 sqrtPriceX96);
    event NonfungibleLiquidityPositionMinted(
        uint256 tokenId,
        uint128 liquidity,
        uint256 amountToken0Used,
        uint256 amountToken1Used
    );
    event BalanceCheck(uint256);

    constructor(uint256 contractBalance_, uint256 ownerBalance_)
        ERC20("MockToken", "MOCK2536")
    {
        poolDeployed = false;

        v3Factory = IUniswapV3Factory(
            0x1F98431c8aD98523631AE4a59f267346ea31F984
        );
        v3NPM = INonfungiblePositionManager(
            0xC36442b4a4522E871399CD717aBDD847Ab11FE88
        );
        weth9c = IWETH9(0xc778417E063141139Fce010982780140Aa0cD5Ab);

        _mint(address(this), contractBalance_);
        _mint(msg.sender, ownerBalance_);

        emit BalanceCheck(weth9c.balanceOf(msg.sender));
    }

    //always input sqrtPrice as if deciding this/weth

    function selfDeployPool(uint160 price_, uint24 fee) external {
        require(!poolDeployed, "only once");
        // deploy pool with fee in hundreths of bip so 0.0001*fee = fee%

        address poolAddress =
            v3Factory.createPool(
                0xc778417E063141139Fce010982780140Aa0cD5Ab,
                address(this),
                fee
            );

        deployedPool = IUniswapV3Pool(poolAddress);

        price_ = (deployedPool.token1() == address(this)) ? uint160(price_ << 96) : uint160(uint160(1 << 96).div(price_));

        deployedPool.initialize(price_);

        emit PoolInitialized(poolAddress, price_);

        poolDeployed = true;
    }

    function addWETH() external payable {
        address payable weth9cAddress = payable(address(weth9c));
        // has fallback function
        weth9cAddress.send(msg.value);
    }

    function mintNonfungibleLiquidityPosition(
        uint256 amountWETH_,
        uint256 amountThis_,
        uint256 amountWETH_min,
        uint256 amountThis_min,
        int24 tick0_,
        int24 tick1_
    ) external {

        uint256 allowed = weth9c.allowance(msg.sender, address(this));

        require(
            allowed >= amountWETH_,
            "Please allow the contract to withdraw more WETH"
        );

        weth9c.transferFrom(msg.sender, address(this), amountWETH_);

        require(amountThis_ <= balanceOf(address(this)), "this account needs more needs more of the tokens");

        if (!(deployedPool.token1() == address(this))) {
            (amountWETH_, amountWETH_min, amountThis_, amountThis_min) = (
                amountThis_,
                amountThis_min,
                amountWETH_,
                amountWETH_min
            );

            (tick0_, tick1_) = (tick1_*(-1), tick0_*(-1));
        }


        uint128 liquidity;
        uint256 used0;
        uint256 used1;

        weth9c.approve(0xC36442b4a4522E871399CD717aBDD847Ab11FE88, MAX_INT);

        _approve(
            address(this),
            0xC36442b4a4522E871399CD717aBDD847Ab11FE88,
            MAX_INT
        );

        require(
            amountWETH_ >= amountWETH_min && amountThis_ >= amountThis_min,
            "max > min must be true"
        );

        (tokenId, liquidity, used0, used1) = v3NPM.mint(
            INonfungiblePositionManager.MintParams({
                token1: deployedPool.token1(),
                token0: deployedPool.token0(),
                fee: deployedPool.fee(),
                tickLower: tick0_,
                tickUpper: tick1_,
                amount0Desired: amountWETH_,
                amount1Desired: amountThis_,
                amount0Min: amountWETH_min,
                amount1Min: amountThis_min,
                recipient: address(this),
                deadline: uint256(block.timestamp).add(4 minutes)
            })
        );

        // weth9c.transferFrom(address(this), msg.sender, amountWETH_.sub(used0));

        emit NonfungibleLiquidityPositionMinted(
            tokenId,
            liquidity,
            used0,
            used1
        );
    }

    event NFTTOKENID(uint256);

    function transferNFT() external returns (uint256) {
        v3NPM.safeTransferFrom(address(this), msg.sender, tokenId);
        emit NFTTOKENID(tokenId);
        return tokenId;
    }

    event Liquidity(uint128);

    function returnLiquidityOfPool() external returns (uint128 liq) {
        liq = deployedPool.liquidity();
        emit Liquidity(liq);
        return liq;
    }

    event Fees(uint128, uint128);

    function returnFeesOfPool()
        external
        returns (uint128 token0, uint128 token1)
    {
        (token0, token1) = deployedPool.protocolFees();
        emit Fees(token0, token1);
        // not letting implicit declares
        return (token0, token1);
    }

    event FeesGlobal(uint256, uint256);

    function returnFeesGlobal() external returns (uint256 fg1, uint256 fg2) {
        (fg1, fg2) = (
            deployedPool.feeGrowthGlobal0X128(),
            deployedPool.feeGrowthGlobal1X128()
        );
        emit FeesGlobal(fg1, fg2);
        return (fg1, fg2);
    }
}
