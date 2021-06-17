// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {
    TransferHelper
} from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {
    INonfungiblePositionManager
} from "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import {Quoter} from "@uniswap/v3-periphery/contracts/lens/Quoter.sol";
import {
    IUniswapV3Pool
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {
    PoolAddress
} from "@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol";
import {FullMath} from "@uniswap/v3-core/contracts/libraries/FullMath.sol";

/// @author Alchemy Team
/// @title Alchemy
/// @notice The Alchemy contract wraps nfts into erc20
contract Alchemy is IERC20 {
    // using Openzeppelin contracts for SafeMath and Address, TransferHelper from the (uni?) library
    using SafeMath for uint256;
    using Address for address;
    // uinv3 update - fried
    using SafeMath for uint128;
    using TransferHelper for address;

    // presenting the total supply
    uint256 internal _totalSupply;

    // representing the name of the governance token
    string internal _name;

    // representing the symbol of the governance token
    string internal _symbol;

    // representing the decimals of the governance token
    uint8 internal constant _decimals = 18;

    // a record of balance of a specific account by address
    mapping(address => uint256) private _balances;

    // a record of allowances for a specific address by address to address mapping
    mapping(address => mapping(address => uint256)) private _allowances;

    // presenting the shares for sale
    uint256 public _sharesForSale;

    // struct for raised nfts
    struct _raisedNftStruct {
        IERC721 nftaddress;
        bool forSale;
        uint256 tokenid;
        uint256 price;
    }

    // The total number of NfTs in the DAO
    uint256 public _nftCount;

    // array for raised nfts
    _raisedNftStruct[] public _raisedNftArray;

    // univ3 NFT for ease of access
    _raisedNftStruct public nonfungiblePosition;

    // mapping to store the already owned nfts
    mapping(address => mapping(uint256 => bool)) public _ownedAlready;

    // the buyout price. once its met, all nfts will be transferred to the buyer
    uint256 public _buyoutPrice;

    // the address which has bought the dao
    address public _buyoutAddress;

    // representing the governance contract of the nft
    address public _governor;

    // representing the timelock address of the nft for the governor
    address public _timelock;

    // factory contract address
    address public _factoryContract;

    // boolean representing if univ3 NFT contract
    bool public isFungibleLiquidityPosition;

    // bool representing if contract has been locked forever and cannot become a univ3 position
    bool public permaNonfungiblePositionDisabled;

    // A record of each accounts delegate
    mapping(address => address) public delegates;

    // A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint256 votes;
        uint32 fromBlock;
    }

    // A record of votes checkpoints for each account, by index
    mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;

    // The number of checkpoints for each account
    mapping(address => uint32) public numCheckpoints;

    // A record of states for signing / validating signatures
    mapping(address => uint256) public nonces;

    // PositionManager that operates upon NFT's
    INonfungiblePositionManager public positionManager;

    // in case we have the above we also take the token pool immediately
    IUniswapV3Pool public tokenPool;

    // Events
    event DelegateChanged(
        address indexed delegator,
        address indexed fromDelegate,
        address indexed toDelegate
    );
    event DelegateVotesChanged(
        address indexed delegate,
        uint256 previousBalance,
        uint256 newBalance
    );
    event Buyout(address buyer, uint256 price);
    event BuyoutTransfer(address nftaddress, uint256 nftid);
    event BurnedForEth(address account, uint256 reward);
    event SharesBought(address account, uint256 amount);
    event SharesBurned(uint256 amount);
    event SharesMinted(uint256 amount);
    event NewBuyoutPrice(uint256 price);
    event NftSaleChanged(uint256 nftid, uint256 price, bool sale);
    event SingleNftBought(address account, uint256 nftid, uint256 price);
    event NftAdded(address nftaddress, uint256 nftid);
    event NftTransferredAndAdded(address nftaddress, uint256 nftid);
    event TransactionExecuted(
        address target,
        uint256 value,
        string signature,
        bytes data
    );

    constructor() {
        // Don't allow implementation to be initialized.
        _factoryContract = address(1);
    }

    function initialize(
        IERC721[] memory nftAddresses_,
        address owner_,
        uint256[] memory tokenIds_,
        uint256 totalSupply_,
        string memory name_,
        string memory symbol_,
        uint256 buyoutPrice_,
        address factoryContract,
        address governor_,
        address timelock_
    ) external {
        require(_factoryContract == address(0), "already initialized");
        require(factoryContract != address(0), "factory can not be null");

        _factoryContract = factoryContract;
        _governor = governor_;
        _timelock = timelock_;

        for (uint256 i = 0; i < nftAddresses_.length; i++) {
            _raisedNftArray.push(
                _raisedNftStruct({
                    nftaddress: nftAddresses_[i],
                    tokenid: tokenIds_[i],
                    forSale: false,
                    price: 0
                })
            );

            _ownedAlready[address(nftAddresses_[i])][tokenIds_[i]] = true;
            _nftCount++;
        }

        // no difference as to if it's initialized or not, but better than uninitialized
        positionManager = INonfungiblePositionManager(
            0xC36442b4a4522E871399CD717aBDD847Ab11FE88
        ); //https://github.com/Uniswap/uniswap-v3-periphery/blob/main/deploys.md

        // leave false, if this becomes a nonfungible position then set true after
        isFungibleLiquidityPosition = false;
        permaNonfungiblePositionDisabled = false;

        _totalSupply = totalSupply_;
        _name = name_;
        _symbol = symbol_;
        _buyoutPrice = buyoutPrice_;
        _balances[owner_] = _totalSupply;
        emit Transfer(address(0), owner_, _totalSupply);
    }

    function initializeNonfungiblePosition()
        external
        isNonfungibleLockedForever()
    {
        // tell that this is a fungible liquidity position
        isFungibleLiquidityPosition = true;
        // for ease of access
        nonfungiblePosition = _raisedNftArray[0];
        // so that the function can't be called
        permaNonfungiblePositionDisabled = true;

        // immediately initialize tokenPool since it will be necessary for certain calculations

        (, , address token0, address token1, uint24 fee, , , , , , , ) =
            positionManager.positions(nonfungiblePosition.tokenid);

        tokenPool = IUniswapV3Pool(
            PoolAddress.computeAddress(
                0x1F98431c8aD98523631AE4a59f267346ea31F984,
                PoolAddress.getPoolKey(token0, token1, fee)
            )
        );
    }

    function lockForNonfungiblePositionPermanently()
        external
        isNonfungibleLockedForever()
    {
        permaNonfungiblePositionDisabled = true;
    }

    /**
     * @notice modifier only timelock can call these functions
     */
    modifier onlyTimeLock() {
        require(msg.sender == _timelock, "ALC:Only Timelock can call");
        _;
    }

    /**
     * @notice modifier only timelock or buyout address can call these functions
     */
    modifier onlyTimeLockOrBuyer() {
        require(
            msg.sender == _timelock || msg.sender == _buyoutAddress,
            "ALC:Only Timelock or Buyer can call"
        );
        _;
    }

    /**
     * @notice modifier only if buyoutAddress is not initialized
     */
    modifier stillToBuy() {
        require(_buyoutAddress == address(0), "ALC:Already bought out");
        _;
    }

    /**
     * @notice it's a modifier that can be generally applied but let's call it like this for best practice i suppose
     */
    modifier FungibleLiquidityPositionCheck() {
        require(
            isFungibleLiquidityPosition,
            "Not a fungible liquidity position"
        );
        _;
    }

    /**
     * @notice modifier to determine if nonfungible is locked forevr
     */
    modifier isNonfungibleLockedForever() {
        require(
            !permaNonfungiblePositionDisabled,
            "this DAO is locked forever and cannot become a nonfungible position"
        );
        _;
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing
     * and updating burn tokens for abstraction
     *
     * @param amount the amount to be burned
     */
    function _burn(uint256 amount) internal {
        _totalSupply = _totalSupply.sub(amount);
    }

    /**
     * @dev After a buyout token holders can burn their tokens and get a proportion of the contract balance as a reward
     */
    function burnForETH() external {
        uint256 balance = balanceOf(msg.sender);
        _balances[msg.sender] = 0;
        uint256 contractBalance = address(this).balance;
        uint256 cashOut = contractBalance.mul(balance).div(_totalSupply);
        _burn(balance);
        msg.sender.transfer(cashOut);

        emit BurnedForEth(msg.sender, cashOut);
        emit Transfer(msg.sender, address(0), balance);
    }

    /**
     * @notice Lets any user buy shares if there are shares to be sold
     *
     * @param amount the amount to be bought
     */
    function buyShares(uint256 amount) external payable {
        require(_sharesForSale >= amount, "low shares");
        require(
            msg.value == amount.mul(_buyoutPrice).div(_totalSupply),
            "low value"
        );

        _balances[msg.sender] = _balances[msg.sender].add(amount);
        _sharesForSale = _sharesForSale.sub(amount);

        emit SharesBought(msg.sender, amount);
        emit Transfer(address(0), msg.sender, amount);
    }

    /**
     * @notice view function to get the discounted buyout price
     *
     * @param account the account
     */
    function getBuyoutPriceWithDiscount(address account)
        public
        view
        returns (uint256)
    {
        uint256 balance = _balances[account];
        return
            _buyoutPrice
                .mul((_totalSupply.sub(balance)).mul(10**18).div(_totalSupply))
                .div(10**18);
    }

    /**
     * @notice Lets anyone buyout the whole dao if they send ETH according to the buyout price
     * all nfts will be transferred to the buyer
     * also a fee will be distributed 0.5%
     */
    function buyout() external payable stillToBuy {
        uint256 buyoutPriceWithDiscount =
            getBuyoutPriceWithDiscount(msg.sender);
        require(msg.value == buyoutPriceWithDiscount, "buy value not met");

        uint256 balance = _balances[msg.sender];
        _balances[msg.sender] = 0;
        _burn(balance);

        // Take 0.5% fee
        address payable alchemyRouter =
            IAlchemyFactory(_factoryContract).getAlchemyRouter();
        IAlchemyRouter(alchemyRouter).deposit{
            value: buyoutPriceWithDiscount / 200
        }();

        // set buyer address
        _buyoutAddress = msg.sender;

        emit Buyout(msg.sender, buyoutPriceWithDiscount);
        emit Transfer(msg.sender, address(0), balance);
    }

    /**
     * @notice transfers specific nfts after the buyout happened
     *
     * @param nftids the array of nft ids
     */
    function buyoutWithdraw(uint256[] memory nftids) external {
        require(
            msg.sender == _buyoutAddress,
            "can only be called by the buyer"
        );

        _raisedNftStruct[] memory raisedNftArray = _raisedNftArray;

        for (uint256 i = 0; i < nftids.length; i++) {
            raisedNftArray[nftids[i]].nftaddress.safeTransferFrom(
                address(this),
                msg.sender,
                raisedNftArray[nftids[i]].tokenid
            );
            emit BuyoutTransfer(
                address(raisedNftArray[nftids[i]].nftaddress),
                raisedNftArray[nftids[i]].tokenid
            );
        }
    }

    /**
     * @notice decreases shares for sale on the open market
     *
     * @param amount the amount to be burned
     */
    function burnSharesForSale(uint256 amount) external onlyTimeLock {
        require(_sharesForSale >= amount, "Low shares");

        _burn(amount);
        _sharesForSale = _sharesForSale.sub(amount);

        emit SharesBurned(amount);
        emit Transfer(msg.sender, address(0), amount);
    }

    /**
     * @notice increases shares for sale on the open market
     *
     * @param amount the amount to be minted
     */
    function mintSharesForSale(uint256 amount) external onlyTimeLock {
        _totalSupply = _totalSupply.add(amount);
        _sharesForSale = _sharesForSale.add(amount);

        emit SharesMinted(amount);
        emit Transfer(address(0), address(this), amount);
    }

    /**
     * @notice changes the buyout price for the whole dao
     *
     * @param amount to set the new price
     */
    function changeBuyoutPrice(uint256 amount) external onlyTimeLock {
        _buyoutPrice = amount;
        emit NewBuyoutPrice(amount);
    }

    ////////////////////////////////////
    // UNIV3

    event portionOfLiquidityAdded(
        address account,
        uint256 sharesReceived,
        uint256 amount0Added,
        uint256 amount1Added
    );
    event checkadr(address);

    /**
     * @notice adds liquidity and mints shares based on added liquidity
     * @param amount0ToTrySpend max token0 to try and spend
     * @param amount1ToTrySpend max token1 to try and spend
     * @param amount0MinToSpend min token0 to try and spend
     * @param amount1MinToSpend min token1 to try and spend
     * */
    function addPortionOfCurrentLiquidity(
        uint256 amount0ToTrySpend,
        uint256 amount1ToTrySpend,
        uint256 amount0MinToSpend,
        uint256 amount1MinToSpend
    ) external FungibleLiquidityPositionCheck() {

        // get old liquidity
        (
            ,
            ,
            address token0,
            address token1,
            ,
            ,
            ,
            uint128 currentLiquidity,
            ,
            ,
            ,
        ) = positionManager.positions(nonfungiblePosition.tokenid);

        if (!(tokenPool.token1() == address(this))) {
            (amount0ToTrySpend, amount1ToTrySpend, amount0MinToSpend, amount1MinToSpend) = (amount1ToTrySpend, amount0ToTrySpend, amount1MinToSpend, amount0MinToSpend);
        }

        // transfer from liquidity provider to this contract
        token0.safeTransferFrom(msg.sender, address(this), amount0ToTrySpend);
        token1.safeTransferFrom(msg.sender, address(this), amount1ToTrySpend);

        token0.call(abi.encodeWithSignature("approve(address,uint256)", address(positionManager), amount0ToTrySpend));
        token1.call(abi.encodeWithSignature("approve(address,uint256)", address(positionManager), amount1ToTrySpend));

        (uint128 newLiquidity, uint256 amount0, uint256 amount1) =
            positionManager.increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: nonfungiblePosition.tokenid,
                    amount0Desired: amount0ToTrySpend,
                    amount1Desired: amount1ToTrySpend,
                    amount0Min: amount0MinToSpend,
                    amount1Min: amount1MinToSpend,
                    deadline: block.timestamp
                })
            );

        uint256 sharesToMint =
            uint256(newLiquidity.mul(totalSupply()).div(currentLiquidity)).sub(
                totalSupply()
            );

        _mint(msg.sender, sharesToMint);

        // transfer back to sender unspent rest
        token0.safeTransfer(msg.sender, amount0ToTrySpend.sub(amount0));
        token1.safeTransfer(msg.sender, amount1ToTrySpend.sub(amount1));

        emit portionOfLiquidityAdded(
            msg.sender,
            sharesToMint,
            amount0,
            amount1
        );
    }

    event portionOfLiquidityWithdrawn(
        address account,
        uint256 sharesBurned,
        uint256 amount0Collected,
        uint256 amount1Collected
    );

    /**
     * @notice withdraws portion of current liquidity
     * @param burnerShares amount of shares to be burned
     * @param minimumToken0Out min amount of token 0 you want back
     * @param minimumToken1Out min amount of token 0 you want back
     * */
    function withdrawPortionOfCurrentLiquidity(
        uint256 burnerShares,
        uint256 minimumToken0Out,
        uint256 minimumToken1Out
    ) external FungibleLiquidityPositionCheck() {
        // immediately burn tokens
        uint256 balance = balanceOf(msg.sender);
        require(balance >= burnerShares, "Can't burn more than you have");

        if (!(tokenPool.token1() == address(this))) {
            (minimumToken0Out, minimumToken1Out) = (minimumToken1Out, minimumToken0Out);
        }

        _balances[msg.sender] = balance - burnerShares;
        uint256 oldTotalSupply = totalSupply();
        _burn(burnerShares);

        (, , , , , , , uint128 currentLiquidity, , , , ) =
            positionManager.positions(nonfungiblePosition.tokenid);

        uint128 newLiquidity =
            uint128(
                SafeMath.div(
                    SafeMath.mul(currentLiquidity, totalSupply()),
                    oldTotalSupply
                )
            );

        //  Decrease liquidity, tokens are accounted to position.
        (uint256 amount0, uint256 amount1) =
            positionManager.decreaseLiquidity(
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: nonfungiblePosition.tokenid,
                    liquidity: (currentLiquidity - newLiquidity), // apparently it will exactly reduce the amount of liquidity but then possibly not give you all of the tokens back, // so sadly it can't be compensated in shares
                    amount0Min: minimumToken0Out, // min out
                    amount1Min: minimumToken1Out, // min out
                    deadline: block.timestamp // will look into
                })
            );

        // collect from position
        (uint256 amount0Collected, uint256 amount1Collected) =
            positionManager.collect(
                INonfungiblePositionManager.CollectParams({
                    tokenId: nonfungiblePosition.tokenid,
                    recipient: msg.sender,
                    amount0Max: uint128(amount0),
                    amount1Max: uint128(amount1)
                })
            );

        emit portionOfLiquidityWithdrawn(
            msg.sender,
            burnerShares,
            amount0Collected,
            amount1Collected
        );
    }

    function getToken0() external view returns (address) {
        return tokenPool.token0();
    }

    function getToken1() external view returns (address) {
        return tokenPool.token1();
    }

    function parseRevertReason(bytes memory reason)
        external
        pure
        returns (uint256)
    {
        if (reason.length != 32) {
            if (reason.length < 68) revert("Unexpected error");
            assembly {
                reason := add(reason, 0x04)
            }
            revert(abi.decode(reason, (string)));
        }
        return abi.decode(reason, (uint256));
    }

    function quoteLiquidityAddition(
        uint256 amount0ToTrySpend,
        uint256 amount1ToTrySpend,
        uint256 amount0MinToSpend,
        uint256 amount1MinToSpend
    ) public returns (uint256) {
        try
            this.addPortionOfCurrentLiquidity(
                amount0ToTrySpend,
                amount1ToTrySpend,
                amount0MinToSpend,
                amount1MinToSpend
            )
        {} catch (bytes memory reason) {
            return this.parseRevertReason(reason);
        }
    }

    ////////////////////////////////////

    /**
     * @notice allows the dao to set a specific nft on sale or to close the sale
     *
     * @param nftarrayid the nftarray id
     * @param price the buyout price for the specific nft
     * @param sale bool indicates the sale status
     */
    function setNftSale(
        uint256 nftarrayid,
        uint256 price,
        bool sale
    ) external onlyTimeLock {
        _raisedNftArray[nftarrayid].forSale = sale;
        _raisedNftArray[nftarrayid].price = price;

        emit NftSaleChanged(nftarrayid, price, sale);
    }

    /**
     * @notice allows anyone to buy a specific nft if it is on sale
     * takes a fee of 0.5% on sale
     * @param nftarrayid the nftarray id
     */
    function buySingleNft(uint256 nftarrayid) external payable stillToBuy {
        _raisedNftStruct memory singleNft = _raisedNftArray[nftarrayid];

        require(singleNft.forSale, "Not for sale");
        require(msg.value == singleNft.price, "Price too low");

        // Take 0.5% fee
        address payable alchemyRouter =
            IAlchemyFactory(_factoryContract).getAlchemyRouter();
        IAlchemyRouter(alchemyRouter).deposit{value: singleNft.price / 200}();

        _ownedAlready[address(singleNft.nftaddress)][singleNft.tokenid] = false;
        _nftCount--;

        for (uint256 i = nftarrayid; i < _raisedNftArray.length - 1; i++) {
            _raisedNftArray[i] = _raisedNftArray[i + 1];
        }
        _raisedNftArray.pop();

        singleNft.nftaddress.safeTransferFrom(
            address(this),
            msg.sender,
            singleNft.tokenid
        );

        emit SingleNftBought(msg.sender, nftarrayid, singleNft.price);
    }

    /**
     * @notice adds a new nft to the nft array
     * must be approved and transferred extra
     *
     * @param new_nft the address of the new nft
     * @param tokenid the if of the nft token
     */
    function addNft(address new_nft, uint256 tokenid)
        public
        onlyTimeLockOrBuyer
    {
        require(
            _ownedAlready[new_nft][tokenid] == false,
            "ALC: Cant add duplicate NFT"
        );
        _raisedNftStruct memory temp_struct;
        temp_struct.nftaddress = IERC721(new_nft);
        temp_struct.tokenid = tokenid;
        _raisedNftArray.push(temp_struct);
        _nftCount++;

        _ownedAlready[new_nft][tokenid] = true;
        emit NftAdded(new_nft, tokenid);
    }

    /**
     * @notice transfers an NFT to the DAO contract (called by executeTransaction function)
     *
     * @param new_nft the address of the new nft
     * @param tokenid the if of the nft token
     */
    function transferFromAndAdd(address new_nft, uint256 tokenid)
        public
        onlyTimeLockOrBuyer
    {
        IERC721(new_nft).transferFrom(
            IERC721(new_nft).ownerOf(tokenid),
            address(this),
            tokenid
        );
        addNft(new_nft, tokenid);

        emit NftTransferredAndAdded(new_nft, tokenid);
    }

    /**
     * @notice adds an NFT collection to the DAO contract
     *
     * @param new_nft_array the address of the new nft
     * @param tokenid_array the id of the nft token
     */
    function addNftCollection(
        address[] memory new_nft_array,
        uint256[] memory tokenid_array
    ) public onlyTimeLockOrBuyer {
        for (uint256 i = 0; i <= new_nft_array.length - 1; i++) {
            addNft(new_nft_array[i], tokenid_array[i]);
        }
    }

    /**
     * @notice transfers an NFT collection to the DAO contract
     *
     * @param new_nft_array the address of the new nft
     * @param tokenid_array the id of the nft token
     */
    function transferFromAndAddCollection(
        address[] memory new_nft_array,
        uint256[] memory tokenid_array
    ) public onlyTimeLockOrBuyer {
        for (uint256 i = 0; i <= new_nft_array.length - 1; i++) {
            transferFromAndAdd(new_nft_array[i], tokenid_array[i]);
        }
    }

    /**
     * @notice executes any transaction
     *
     * @param target the target of the call
     * @param value the value of the call
     * @param signature the signature of the function call
     * @param data the calldata
     */
    function executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data
    ) external payable onlyTimeLock returns (bytes memory) {
        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(
                bytes4(keccak256(bytes(signature))),
                data
            );
        }

        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) =
            target.call{value: value}(callData);
        require(success, "ALC:exec reverted");

        emit TransactionExecuted(target, value, signature, data);
        return returnData;
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For example, if `decimals` equals `2`, a balance of `505` tokens should
     * be displayed to a user as `5,05` (`505 / 10 ** 2`.
     *
     * NOTE: This information is only used for _display_ purposes: it in
     * no way affects any of the arithmetic of the contract, including
     * {IERC20-balanceOf} and {IERC20-transfer}.
     */
    function decimals() public pure returns (uint8) {
        return _decimals;
    }

    /**
     * @dev See {IERC20-totalSupply}.
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev See {IERC20-balanceOf}. Uses burn abstraction for balance updates without gas and universally.
     */
    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address dst, uint256 rawAmount)
        external
        override
        returns (bool)
    {
        uint256 amount = rawAmount;
        _transferTokens(msg.sender, dst, amount);
        return true;
    }

    /**
     * fallback function for collection funds
     */
    fallback() external payable {}

    receive() external payable {}

    /**
     * @dev See {IERC20-allowance}.
     */
    function allowance(address owner, address spender)
        public
        view
        override
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount)
        public
        override
        returns (bool)
    {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20};
     *
     * Requirements:
     * - `sender` and `recipient` cannot be the zero ress.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for ``sender``'s tokens of at least
     * `amount`.
     */
    function transferFrom(
        address src,
        address dst,
        uint256 rawAmount
    ) external override returns (bool) {
        address spender = msg.sender;
        uint256 spenderAllowance = _allowances[src][spender];
        uint256 amount = rawAmount;

        if (spender != src && spenderAllowance != uint256(-1)) {
            uint256 newAllowance =
                spenderAllowance.sub(amount, "NFTDAO:amount exceeds");
            _allowances[src][spender] = newAllowance;
        }

        _transferTokens(src, dst, amount);
        return true;
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");
        _totalSupply += amount;
        _balances[account] += amount;
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner`s tokens.
     *
     * This is internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        require(owner != address(0), "ERC20: approve from 0");
        require(spender != address(0), "ERC20: approve to 0");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        require(sender != address(0), "ERC20: transfer from 0");
        require(recipient != address(0), "ERC20: transfer to 0");
        _balances[sender] = _balances[sender].sub(
            amount,
            "ERC20: transfer amount exceeds"
        );
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) public {
        return _delegate(msg.sender, delegatee);
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external view returns (uint256) {
        uint32 nCheckpoints = numCheckpoints[account];
        return
            nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint256 blockNumber)
        public
        view
        returns (uint256)
    {
        require(blockNumber < block.number, "ALC:getPriorVotes");

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].votes;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.votes;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].votes;
    }

    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates[delegator];
        uint256 delegatorBalance = _balances[delegator];
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    function _transferTokens(
        address src,
        address dst,
        uint256 amount
    ) internal {
        require(src != address(0), "ALC: cannot transfer 0");
        require(dst != address(0), "ALC: cannot transfer 0");

        _balances[src] = _balances[src].sub(amount, "ALC:_transferTokens");
        _balances[dst] = _balances[dst].add(amount);
        emit Transfer(src, dst, amount);

        _moveDelegates(delegates[src], delegates[dst], amount);
    }

    function _moveDelegates(
        address srcRep,
        address dstRep,
        uint256 amount
    ) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint256 srcRepOld =
                    srcRepNum > 0
                        ? checkpoints[srcRep][srcRepNum - 1].votes
                        : 0;
                uint256 srcRepNew = srcRepOld.sub(amount, "ALC:_moveVotes");
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint256 dstRepOld =
                    dstRepNum > 0
                        ? checkpoints[dstRep][dstRepNum - 1].votes
                        : 0;
                uint256 dstRepNew = dstRepOld.add(amount);
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(
        address delegatee,
        uint32 nCheckpoints,
        uint256 oldVotes,
        uint256 newVotes
    ) internal {
        uint32 blockNumber = safe32(block.number, "ALC:_writeCheck");

        if (
            nCheckpoints > 0 &&
            checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber
        ) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(
                newVotes,
                blockNumber
            );
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function safe32(uint256 n, string memory errorMessage)
        internal
        pure
        returns (uint32)
    {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }

    function getChainId() internal pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
}

interface IAlchemyFactory {
    function getAlchemyRouter() external view returns (address payable);
}

interface IAlchemyRouter {
    function deposit() external payable;
}
