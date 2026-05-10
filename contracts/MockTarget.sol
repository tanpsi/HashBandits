// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MockTarget {
    uint256 public value;

    /// @notice Sets the target value
    /// @param v The new value to store
    function setValue(uint256 v) external {
        value = v;
    }
}
