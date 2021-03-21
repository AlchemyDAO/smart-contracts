// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "../libraries/CloneLibrary.sol";

/**
 * Test for CloneLibrary to ensure it is EIP-1167 compliant.
 * 363d3d373d3d3d363d73bebebebebebebebebebebebebebebebebebebebe5af43d82803e903d91602b57fd5bf3
*/
contract TestClone {
  constructor() {
    address target = 0xBEbeBeBEbeBebeBeBEBEbebEBeBeBebeBeBebebe;
    address proxy = CloneLibrary.createClone(target);
    require(CloneLibrary.isClone(target, proxy));
    bytes memory code = new bytes(45);
    assembly { extcodecopy(proxy, add(code, 32), 0, 45) }
    require(
      keccak256(code) == keccak256(hex"363d3d373d3d3d363d73bebebebebebebebebebebebebebebebebebebebe5af43d82803e903d91602b57fd5bf3")
    );
  }
}