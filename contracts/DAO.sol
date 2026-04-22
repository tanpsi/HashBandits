// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DAO
 * @notice Minimal DAO governance with snapshot-based voting.
 */

/// Minimal interface to interact with token snapshots
interface ITokenSnapshot {
    function snapshot() external returns (uint256);
    function balanceOfAt(address account, uint256 snapshotId) external view returns (uint256);
    function totalSupplyAt(uint256 snapshotId) external view returns (uint256);
}

contract DAO is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    ITokenSnapshot public immutable token;

    uint256 public quorumPercent; // e.g., 30 for 30%

    struct Proposal {
        address target;
        bytes data;
        uint256 snapshotId;
        uint256 deadline;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        address creator;
    }

    Proposal[] public proposals;

    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed id, address indexed creator, address target, uint256 snapshotId, uint256 deadline);
    event VoteCast(uint256 indexed id, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCancelled(uint256 indexed id);

    /**
     * @param _token Address of token (must implement snapshot + balanceOfAt + totalSupplyAt)
     * @param _quorumPercent Percent of total supply required for quorum (0-100)
     */
    constructor(address _token, uint256 _quorumPercent) {
        require(_quorumPercent <= 100, "Invalid quorum");
        token = ITokenSnapshot(_token);
        quorumPercent = _quorumPercent;
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /// @notice Create a proposal. Takes a snapshot and stores snapshotId.
    /// @param target Target contract to call if executed
    /// @param data Calldata to pass to `target` on execute
    /// @param deadline Timestamp after which voting closes
    function createProposal(address target, bytes calldata data, uint256 deadline) external returns (uint256) {
        require(deadline > block.timestamp, "Invalid deadline");
        uint256 snapshotId = token.snapshot();
        Proposal memory p = Proposal({
            target: target,
            data: data,
            snapshotId: snapshotId,
            deadline: deadline,
            forVotes: 0,
            againstVotes: 0,
            executed: false,
            creator: msg.sender
        });
        proposals.push(p);
        uint256 id = proposals.length - 1;
        emit ProposalCreated(id, msg.sender, target, snapshotId, deadline);
        return id;
    }

    /// @notice Cast a vote for a proposal. Weight is token balance at proposal snapshot.
    function vote(uint256 proposalId, bool support) external {
        require(proposalId < proposals.length, "Proposal not found");
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        require(block.timestamp < p.deadline, "Voting closed");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        uint256 weight = token.balanceOfAt(msg.sender, p.snapshotId);
        require(weight > 0, "No voting power");
        hasVoted[proposalId][msg.sender] = true;
        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }
        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /// @notice Execute a proposal if quorum and majority passed. Non-reentrant.
    function executeProposal(uint256 proposalId) external nonReentrant {
        require(proposalId < proposals.length, "Proposal not found");
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        require(block.timestamp >= p.deadline, "Voting not ended");
        uint256 total = token.totalSupplyAt(p.snapshotId);
        require(total > 0, "Total supply zero");
        uint256 quorumNeeded = (total * quorumPercent) / 100;
        require(p.forVotes >= quorumNeeded, "Quorum not reached");
        require(p.forVotes > p.againstVotes, "Not majority");

        p.executed = true;
        (bool success, ) = p.target.call(p.data);
        require(success, "Execution failed");
        emit ProposalExecuted(proposalId);
    }

    /// @notice Cancel a proposal. Only creator can cancel before any votes are cast.
    function cancelProposal(uint256 proposalId) external {
        require(proposalId < proposals.length, "Proposal not found");
        Proposal storage p = proposals[proposalId];
        require(msg.sender == p.creator, "Not creator");
        require(p.forVotes == 0 && p.againstVotes == 0, "Votes already cast");
        require(!p.executed, "Already executed");
        // mark as executed to prevent later execution
        p.executed = true;
        emit ProposalCancelled(proposalId);
    }

    /// @notice Update quorum percent. ADMIN_ROLE only.
    function setQuorumPercent(uint256 _q) external onlyRole(ADMIN_ROLE) {
        require(_q <= 100, "Invalid quorum");
        quorumPercent = _q;
    }
}
