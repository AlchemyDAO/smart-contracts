// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";


/// @author Alchemy Team
/// @title Alchemy
/// @notice The Alchemy contract wraps nfts into erc20
contract Alchemy is IERC20 {

    // using Openzeppelin contracts for SafeMath and Address
    using SafeMath for uint256;
    using Address for address;

    // presenting the total supply
    uint256 private _totalSupply;

    // representing the name of the governance token
    string public _name;

    // representing the symbol of the governance token
    string public _symbol;

    // representing the decimals of the governance token
    uint8 public immutable _decimals = 18;

    // a record of balance of a specific account by address
    mapping(address => uint256) private _balances;

    // a record of allowances for a specific address by address to address mapping
    mapping(address => mapping(address => uint256)) private _allowances;

    // presenting the shares for sale
    uint256 public _sharesForSale;

    // struct for raised nfts
    struct _raisedNftStruct {
        IERC721 nftaddress;
        uint tokenid;
        uint price;
        bool forSale;
    }

    // The total number of NfTs in the DAO
    uint256 public _nftCount;

    // array for raised nfts
    mapping (uint256 => _raisedNftStruct) public _raisedNftArray;

    // the owner and creator of the contract
    address public _owner;

    // the buyout price. once its met, all nfts will be transferred to the buyer
    uint256 public _buyoutPrice;

    // representing the governance contract of the nft
    address public _governor;

    // representing the timelock address of the nft for the governor
    address public _timelock;

    // factory contract address
    address public _factoryContract;

    // A record of each accounts delegate
    mapping (address => address) public delegates;

    // A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint32 fromBlock;
        uint256 votes;
    }

    // A record of votes checkpoints for each account, by index
    mapping (address => mapping (uint32 => Checkpoint)) public checkpoints;

    // The number of checkpoints for each account
    mapping (address => uint32) public numCheckpoints;

    // A record of states for signing / validating signatures
    mapping (address => uint) public nonces;

    // An event thats emitted when an account changes its delegate
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);

    // An event thats emitted when a delegate account's vote balance changes
    event DelegateVotesChanged(address indexed delegate, uint previousBalance, uint newBalance);


    constructor (
        IERC721 nftAddress_,
        address owner_,
        uint256 tokenId_,
        uint256 totalSupply_,
        string memory name_,
        string memory symbol_,
        uint256 buyoutPrice_,
        address factoryContract
    )
    {
        _owner = owner_;
        _factoryContract = factoryContract;

        _nftCount++;
        _raisedNftArray[_nftCount].nftaddress = nftAddress_;
        _raisedNftArray[_nftCount].tokenid = tokenId_;

        _totalSupply = totalSupply_ * 10 ** 18;
        _name = name_;
        _symbol = symbol_;
        _buyoutPrice = buyoutPrice_;
        _balances[_owner] = _totalSupply;
        emit Transfer(address(0), owner_, _totalSupply);
    }

    /**
    * @dev Init function to set up the contract
    *
    * @param governorFactory the governor alpha factory contract
    * @param votinginit the voting period in blocks
    * @param timelockFactory the timelock factory contract
    * @param timelockinit the timelock delay in seconds
    */
    function init(address governorFactory, uint votinginit, address timelockFactory, uint256 timelockinit) external {
        require(msg.sender == _owner, "only owner");
        require(_governor == address(0));

        _governor = GovernorFactoryInterface(governorFactory).GovernorMint(address(this), _totalSupply, votinginit);
        _timelock = TimelockFactoryInterface(timelockFactory).TimelockMint(_governor, timelockinit);
        GovernorInstance(_governor).init(_timelock);

        _raisedNftArray[_nftCount].nftaddress.transferFrom(_owner, address(this), _raisedNftArray[_nftCount].tokenid);
    }

    /**
    * @dev Destroys `amount` tokens from `account`, reducing
    * and updating burn tokens for abstraction
    *
    * @param amount the amount to be burned
    */
    function _burn(uint256 amount) internal {
        _totalSupply -= amount;
    }

    /**
    * @dev After a buyout token holders can burn their tokens and get a proportion of the contract balance as a reward
    */
    function burnForETH() external {
        uint256 balance = balanceOf(msg.sender);
        _balances[msg.sender] = 0;
        uint256 contractBalalance = address(this).balance;
        uint256 cashout = contractBalalance.mul(balance).div(_totalSupply);
        _burn(balance);
        msg.sender.transfer(cashout);
        emit Transfer(msg.sender, address(0), balance);
    }

    /**
    * @notice Lets any user buy shares if there are shares to be sold
    *
    * @param amount the amount to be bought
    */
    function Buyshares(uint256 amount) external payable {
        require(_sharesForSale >= amount, "low shares");
        require(msg.value >= amount.mul(_buyoutPrice).div(_totalSupply), "low value");

        _balances[msg.sender] += amount;
        _sharesForSale -= amount;

        msg.sender.transfer(msg.value - amount.mul(_buyoutPrice).div(_totalSupply));
    }

    /**
    * @notice Lets anyone buyout the whole dao if they send ETH according to the buyout price
    * all nfts will be transferred to the buyer
    * also a fee will be distributed 0.5%
    */
    function buyout() external payable {
        require(msg.value >= _buyoutPrice, "buy value");

        uint256 balance = _balances[msg.sender];
        _balances[msg.sender] = 0;

        uint256 cost = msg.value.sub(_buyoutPrice.mul((_totalSupply.sub(balance)).div(_totalSupply)));
        _burn(balance);

        for (uint i=1; i<=_nftCount; i++) {
            _raisedNftArray[i].nftaddress.transferFrom(address(this), msg.sender, _raisedNftArray[i].tokenid);
        }

        // Take 0.5% fee
        address payable factoryowner = IAlchemyFactory(_factoryContract).getFactoryOwner();
        IAlchemyRouter(factoryowner).deposit{value:_buyoutPrice / 200}();

        msg.sender.transfer(cost);
        emit Transfer(msg.sender, address(0), balance);
    }

    /**
    * @notice decreases shares for sale on the open market
    *
    * @param amount the amount to be burned
    */
    function burnSharesForSale(uint256 amount) external {
        require(msg.sender == _timelock, "Only TL");
        require(_sharesForSale >= amount, "Low shares");

        _burn(amount);
        _sharesForSale -= amount;

        emit Transfer(msg.sender, address(0), amount);
    }

    /**
    * @notice increases shares for sale on the open market
    *
    * @param amount the amount to be minted
    */
    function mintSharesForSale(uint256 amount) external {
        require(msg.sender == _timelock, "Only TL");

        _totalSupply += amount;
        _sharesForSale += amount;

        emit Transfer(address(0), address(this), amount);
    }

    /**
    * @notice changes the buyout price for the whole dao
    *
    * @param amount to set the new price
    */
    function changeBuyoutPrice(uint256 amount) external {
        require(msg.sender == _timelock, "Only TL");
        _buyoutPrice = amount;
    }

    /**
    * @notice allows the dao to set a specific nft on sale or to close the sale
    *
    * @param nftarrayid the nftarray id
    * @param price the buyout price for the specific nft
    * @param sale bool indicates the sale status
    */
    function setNftSale(uint256 nftarrayid, uint256 price, bool sale) external {
        require(msg.sender == _timelock, "Only TL");

        _raisedNftArray[nftarrayid].forSale = sale;
        _raisedNftArray[nftarrayid].price = price;
    }

    /**
    * @notice allows anyone to buy a specific nft if it is on sale
    * takes a fee of 0.5% on sale
    * @param nftarrayid the nftarray id
    */
    function buySingleNft(uint256 nftarrayid) external payable {
        require(_raisedNftArray[nftarrayid].forSale, "Not for sale");
        require(msg.value >= _raisedNftArray[nftarrayid].price, "Price too low");

        uint256 cost = msg.value.sub(_raisedNftArray[nftarrayid].price);
        _raisedNftArray[nftarrayid].nftaddress.transferFrom(address(this), msg.sender, _raisedNftArray[nftarrayid].tokenid);

        // Take 0.5% fee
        address payable factoryowner = IAlchemyFactory(_factoryContract).getFactoryOwner();
        IAlchemyRouter(factoryowner).deposit{value:_raisedNftArray[nftarrayid].price / 200}();

        _nftCount--;
        delete _raisedNftArray[nftarrayid];
        msg.sender.transfer(cost);
    }

    /**
    * @notice adds a new nft to the nft array
    * must be approved an transferred seperately
    *
    * @param new_nft the address of the new nft
    * @param tokenid the if of the nft token
    */
    function addNft(address new_nft, uint256 tokenid) external{
        require(msg.sender == _timelock, "ALC:Only TL");
                _nftCount++;
        _raisedNftArray[_nftCount].nftaddress = IERC721(new_nft);
        _raisedNftArray[_nftCount].tokenid = tokenid;
    }

    /**
    * @notice returns the nft to the dao owner if allowed by the dao
    */
    function returnNft() external {
        require(msg.sender == _timelock, "ALC:Only TL");

        _raisedNftArray[1].nftaddress.transferFrom(address(this), _owner, _raisedNftArray[1].tokenid);

        _nftCount--;
        delete _raisedNftArray[1];
    }

    /**
    * @notice executes any transaction
    *
    * @param target the target of the call
    * @param value the value of the call
    * @param signature the signature of the function call
    * @param data the calldata
    */
    function executeTransaction(address target, uint256 value, string memory signature, bytes memory data) external payable returns (bytes memory) {
        require(msg.sender == _timelock, "ALC:Only TL");

        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) = target.call{value:value}(callData);
        require(success, "ALC:exec reverted");

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
    function totalSupply() public override view returns (uint256) {
        return _totalSupply;
    }

    /**
    * @dev See {IERC20-balanceOf}. Uses burn abstraction for balance updates without gas and universally.
    */
    function balanceOf(address account) public override view returns (uint256) {
        return
        (_balances[account] * _totalSupply) / (_totalSupply);
    }

    /**
    * @dev See {IERC20-transfer}.
    *
    * Requirements:
    *
    * - `recipient` cannot be the zero address.
    * - the caller must have a balance of at least `amount`.
    */
    function transfer(address dst, uint256 rawAmount) external override returns (bool) {
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
    override
    view
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
    function transferFrom(address src, address dst, uint256 rawAmount) external override returns (bool) {
        address spender = msg.sender;
        uint256 spenderAllowance = _allowances[src][spender];
        uint256 amount = rawAmount;

        if (spender != src && spenderAllowance != uint256(-1)) {
            uint256 newAllowance = spenderAllowance.sub(amount, "NFTDAO:amount exceeds");
            _allowances[src][spender] = newAllowance;

            //emit Approval(src, spender, newAllowance);
        }

        _transferTokens(src, dst, amount);
        return true;
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
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
    }

    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint blockNumber) public view returns (uint256) {
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

    function _transferTokens(address src, address dst, uint256 amount) internal {
        require(src != address(0), "ALC: cannot transfer 0");
        require(dst != address(0), "ALC: cannot transfer 0");

        _balances[src] = _balances[src].sub( amount, "ALC:_transferTokens");
        _balances[dst] = _balances[dst].add( amount);
        emit Transfer(src, dst, amount);

        _moveDelegates(delegates[src], delegates[dst], amount);
    }

    function _moveDelegates(address srcRep, address dstRep, uint256 amount) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint256 srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].votes : 0;
                uint256 srcRepNew = srcRepOld.sub( amount, "ALC:_moveVotes");
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint256 dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].votes : 0;
                uint256 dstRepNew = dstRepOld.add(amount);
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
    }

    function _writeCheckpoint(address delegatee, uint32 nCheckpoints, uint256 oldVotes, uint256 newVotes) internal {
        uint32 blockNumber = safe32(block.number, "ALC:_writeCheck");

        if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber) {
            checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
        } else {
            checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNumber, newVotes);
            numCheckpoints[delegatee] = nCheckpoints + 1;
        }

        emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }

    function safe32(uint n, string memory errorMessage) internal pure returns (uint32) {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }


    function getChainId() internal pure returns (uint) {
        uint256 chainId;
        assembly { chainId := chainid() }
        return chainId;
    }

}

interface TimelockFactoryInterface {
    function TimelockMint(address admin_,uint delay_) external returns (address);
}

interface GovernorFactoryInterface {
    function GovernorMint(address nft_, uint supply_, uint votingtime) external returns (address);

}

interface GovernorInstance {
    function init(address timelock) external;
}

interface IAlc {
    function transfer(address dst, uint256 rawAmount)  external;
    function balanceOf(address account) external view returns (uint256);
}

interface IAlchemyFactory {
    function getFactoryOwner() external view returns (address payable);
}

interface IAlchemyRouter {
    function deposit() external payable;
}

/// @author Alchemy Team
/// @title AlchemyFactory
/// @notice Factory contract to create new instances of Alchemy
contract AlchemyFactory {

    // event thats emitted when a new Alchemy Contract was minted
    event NewAlchemy(address deployed);

    // the Alchemy governance token
    IAlc public alc;

    // the factory owner
    address payable public factoryOwner;

    // set ALC token
    constructor(IAlc _alc) {
        alc = _alc;
        factoryOwner = msg.sender;
    }

    /**
     * @dev distributes the ALC token supply
     *
     * @param amount the amount to distribute
    */
    function distributeAlc(uint amount) internal {
        if (alc.balanceOf(address(this)) >= amount) {
            alc.transfer(msg.sender, amount);
        }
    }

    /**
     * @dev mints a new Alchemy Contract
     *
     * @param nftAddress_ the initial nft address to add to the contract
     * @param owner_ the owner of the contract
     * @param tokenId_ the token id of the nft to be added
     * @param totalSupply_ the total supply of the erc20
     * @param name_ the token name
     * @param symbol_ the token symbol
     * @param buyoutPrice_ the buyout price to buyout the dao
     * @return the address of the newly generated alchemy contract
    */
    function NFTDAOMint(
        IERC721 nftAddress_,
        address owner_,
        uint256 tokenId_,
        uint256 totalSupply_,
        string memory name_,
        string memory symbol_,
        uint256 buyoutPrice_
    ) public returns (address) {
        Alchemy newContract = new Alchemy(
            nftAddress_,
            owner_,
            tokenId_,
            totalSupply_,
            name_,
            symbol_,
            buyoutPrice_,
            address(this)
        );

        // distribute gov token
        distributeAlc(100 * 10 ** 18);

        emit NewAlchemy(address(newContract));
        return address(newContract);
    }

    /**
     * @dev lets the owner change the ownership to another address
     *
     * @param newOwner the address of the new owner
    */
    function newFactoryOwner(address payable newOwner) external {
        require(msg.sender == factoryOwner, "Only owner");
        factoryOwner = newOwner;
    }

    /**
     * @dev gets the address of the current factory owner
     *
     * @return the address of the factory owner
    */
    function getFactoryOwner() public view returns (address payable) {
        return factoryOwner;
    }
}