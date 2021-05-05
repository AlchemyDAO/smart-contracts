// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./libraries/CloneLibrary.sol";

/// @author Conjure Finance Team
/// @title StakingRewardsFactory
/// @notice Factory contract to create new instances of StakingRewards
contract StakingRewardsFactory {
    using CloneLibrary for address;

    event NewStakingRewards(address stakingRewards);
    event FactoryOwnerChanged(address newowner);

    address payable public factoryOwner;
    address public stakingRewardsImplementation;

    constructor(
        address _stakingRewardsImplementation
    )
    {
        require(_stakingRewardsImplementation != address(0), "No zero address for stakingRewardsImplementation");

        factoryOwner = msg.sender;
        stakingRewardsImplementation = _stakingRewardsImplementation;
    }

    /**
     * @dev lets anyone mint a new StakingRewards contract
    */
    function stakingRewardsMint(
        address _owner,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        uint256 _rewardsDuration
    )
    external
    returns (address stakingRewardsAddress)
    {
        stakingRewardsAddress = stakingRewardsImplementation.createClone();

        emit NewStakingRewards(stakingRewardsAddress);

        IStakingRewards(stakingRewardsAddress).initialize(
            _owner,
            _rewardsDistribution,
            _rewardsToken,
            _stakingToken,
            _rewardsDuration,
            address(this)
        );
    }

    /**
     * @dev lets the owner change the current conjure implementation
     *
     * @param stakingRewardsImplementation_ the address of the new implementation
    */
    function newStakingRewardsImplementation(address stakingRewardsImplementation_) external {
        require(msg.sender == factoryOwner, "Only factory owner");
        require(stakingRewardsImplementation_ != address(0), "No zero address for stakingRewardsImplementation_");

        stakingRewardsImplementation = stakingRewardsImplementation_;
    }

    /**
     * @dev lets the owner change the ownership to another address
     *
     * @param newOwner the address of the new owner
    */
    function newFactoryOwner(address payable newOwner) external {
        require(msg.sender == factoryOwner, "Only factory owner");
        require(newOwner != address(0), "No zero address for newOwner");

        factoryOwner = newOwner;
        emit FactoryOwnerChanged(factoryOwner);
    }
}

interface IStakingRewards {
    function initialize(
        address _owner,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        uint256 _rewardsDuration,
        address _factoryContract
    ) external;
}
