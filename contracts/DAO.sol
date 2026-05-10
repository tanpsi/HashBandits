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
    function balanceOf(address account) external view returns (uint256);
    function balanceOfAt(address account, uint256 snapshotId) external view returns (uint256);
    function totalSupplyAt(uint256 snapshotId) external view returns (uint256);
}

error InvalidQuorum();
error ProposalNotFound();
error AlreadyExecuted();
error VotingClosed();
error AlreadyVoted();
error NoVotingPower();
error NotCreator();
error VotingDurationTooShort();
error InsufficientBalance();
error QuorumNotReached();
error NotMajority();
error ExecutionDelayNotPassed();
error ExecutionFailed();
error VotesAlreadyCast();
error TotalSupplyZero();

contract DAO is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    uint256 public constant MIN_VOTING_DURATION = 45 seconds;
    uint256 public constant MIN_PROPOSAL_CREATION_POWER = 10e18;
    uint256 public constant EXECUTION_DELAY = 30 seconds;

    ITokenSnapshot public immutable token;

    // max value only 100 → uint8 sufficient
    uint8 public quorumPercent;

    struct Proposal {
        address target;
        address creator;
        bool executed;

        bytes data;

        uint256 snapshotId;
        uint256 deadline;

        uint256 forVotes;
        uint256 againstVotes;
    }

    Proposal[] public proposals;

    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(
        uint256 indexed id,
        address indexed creator,
        address target,
        uint256 snapshotId,
        uint256 deadline,
        string cid
    );

    event VoteCast(
        uint256 indexed id,
        address indexed voter,
        bool support,
        uint256 weight
    );

    event ProposalExecuted(uint256 indexed id);

    event ProposalCancelled(uint256 indexed id);

    /**
     * @param _token Address of token (must implement snapshot + balanceOfAt + totalSupplyAt)
     * @param _quorumPercent Percent of total supply required for quorum (0-100)
     */
    constructor(address _token, uint8 _quorumPercent) {
        if (_quorumPercent > 100) revert InvalidQuorum();

        token = ITokenSnapshot(_token);
        quorumPercent = _quorumPercent;

        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /// @notice Create a proposal
    /// @param target Target contract to call if executed
    /// @param data Calldata to pass to `target`
    /// @param deadline Voting deadline timestamp
    /// @param cid IPFS CID emitted in event logs
    /// @return ID of the newly created proposal
    function createProposal(
        address target,
        bytes calldata data,
        uint256 deadline,
        string calldata cid
    ) external returns (uint256) {
        if (deadline <= block.timestamp + MIN_VOTING_DURATION) {
            revert VotingDurationTooShort();
        }
        if (token.balanceOf(msg.sender) < MIN_PROPOSAL_CREATION_POWER) {
            revert InsufficientBalance();
        }
        uint256 snapshotId = token.snapshot();
        Proposal memory p = Proposal({
            target: target,
            creator: msg.sender,
            data: data,
            snapshotId: snapshotId,
            deadline: deadline,
            forVotes: 0,
            againstVotes: 0,
            executed: false
        });
        proposals.push(p);
        uint256 id = proposals.length - 1;
        emit ProposalCreated(
            id,
            msg.sender,
            target,
            snapshotId,
            deadline,
            cid
        );
        return id;
    }
    /// @notice Cast a vote for a proposal
    /// @param proposalId ID of the proposal to vote on
    /// @param support True for a yes-vote, false for a no-vote
    function vote(uint256 proposalId, bool support) external {
        if (proposalId >= proposals.length) revert ProposalNotFound();
        Proposal storage p = proposals[proposalId];
        if (p.executed) revert AlreadyExecuted();
        if (block.timestamp >= p.deadline) revert VotingClosed();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();
        uint256 weight = token.balanceOfAt(msg.sender, p.snapshotId);
        if (weight == 0) revert NoVotingPower();
        hasVoted[proposalId][msg.sender] = true;
        if (support) {
            unchecked {
                p.forVotes += weight;
            }
        } else {
            unchecked {
                p.againstVotes += weight;
            }
        }
        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /// @notice Execute proposal if quorum + majority passed
    /// @param proposalId ID of the proposal to execute
    function executeProposal(uint256 proposalId)
        external
        nonReentrant
    {
        if (proposalId >= proposals.length) revert ProposalNotFound();
        Proposal storage p = proposals[proposalId];
        if (p.executed) revert AlreadyExecuted();
        if (block.timestamp < p.deadline + EXECUTION_DELAY) {
            revert ExecutionDelayNotPassed();
        }
        uint256 total = token.totalSupplyAt(p.snapshotId);
        if (total == 0) revert TotalSupplyZero();
        uint256 quorumNeeded = (total * quorumPercent) / 100;
        uint256 forVotes = p.forVotes;
        uint256 againstVotes = p.againstVotes;
        if (forVotes < quorumNeeded) revert QuorumNotReached();
        if (forVotes <= againstVotes) revert NotMajority();
        p.executed = true;
        (bool success, ) = p.target.call(p.data);
        if (!success) revert ExecutionFailed();
        emit ProposalExecuted(proposalId);
    }
    /// @notice Cancel proposal before votes are cast
    /// @param proposalId ID of the proposal to cancel
    function cancelProposal(uint256 proposalId) external {
        if (proposalId >= proposals.length) revert ProposalNotFound();
        Proposal storage p = proposals[proposalId];
        if (msg.sender != p.creator) revert NotCreator();
        if (p.forVotes != 0 || p.againstVotes != 0) {
            revert VotesAlreadyCast();
        }
        if (p.executed) revert AlreadyExecuted();
        p.executed = true;
        emit ProposalCancelled(proposalId);
    }
    /// @notice Update quorum percentage
    /// @param _q New quorum percentage (0-100)
    function setQuorumPercent(uint8 _q)
        external
        onlyRole(ADMIN_ROLE)
    {
        if (_q > 100) revert InvalidQuorum();
        quorumPercent = _q;
    }
}