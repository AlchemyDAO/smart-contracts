// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import {Proxy as OpenZeppelinProxy} from "@openzeppelin/contracts/proxy/Proxy.sol";


contract Proxy is OpenZeppelinProxy {
    address internal immutable implementation;

    constructor(address implementation_) public {
        implementation = implementation_;
    }

    function _implementation() internal view override returns (address) {
        return implementation;
    } 
}