// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GovernanceToken
 * @notice ERC20 token with snapshot capability. Snapshot role controlled via AccessControl.
 */
contract GovernanceToken is ERC20Snapshot, AccessControl {
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");

    /**
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial supply minted to deployer
     */
    constructor(string memory name, string memory symbol, uint256 initialSupply) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _mint(msg.sender, initialSupply);
    }

    /// @notice Create a snapshot. Callable only by addresses with SNAPSHOT_ROLE.
    function snapshot() external returns (uint256) {
        require(hasRole(SNAPSHOT_ROLE, msg.sender), "GovernanceToken: not snapshot role");
        return _snapshot();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override(ERC20Snapshot) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
