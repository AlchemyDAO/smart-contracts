// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IStakingRewards.sol";


contract LPDrip {
    IERC20 public Alch;
    IStakingRewards public Pool;
    uint256 public blocklock;

    constructor(
        IERC20 Alch_,
        IStakingRewards Pool_
    ) public {
        Alch = Alch_;
        Pool = Pool_;
    }

    function drip() public {
        require(tx.origin == msg.sender, "LPDrip: External accounts only");
        require(blocklock <= now, "block");
        Alch.transfer(address(Pool), Alch.balanceOf(address(this)) / 50);
        blocklock = now + 7 days;
        Pool.notifyRewardAmount(Alch.balanceOf(address(this)) / 50);
    }
}
