"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";

function getProposalStatus(proposal) {
  if (proposal.executed && proposal.forVotes === 0n && proposal.againstVotes === 0n) {
    return "cancelled";
  }
  if (proposal.executed) return "executed";
  const now = Math.floor(Date.now() / 1000);
  if (now < Number(proposal.deadline)) return "active";
  // Voting ended
  if (proposal.forVotes > proposal.againstVotes && proposal.forVotes > 0n) {
    return "passed";
  }
  return "failed";
}

function Countdown({ deadline }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgency, setUrgency] = useState("active");

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const dl = Number(deadline);
      const diff = dl - now;

      if (diff <= 0) {
        setTimeLeft("Ended");
        setUrgency("ended");
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;

      if (days > 0) setTimeLeft(`${days}d ${hours}h ${mins}m`);
      else if (hours > 0) setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      else setTimeLeft(`${mins}m ${secs}s`);

      setUrgency(diff < 300 ? "urgent" : "active");
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  return <span className={`countdown ${urgency}`}>{timeLeft}</span>;
}

export default function ProposalCard({ proposalId, proposal, onToast }) {
  const { daoContract, account, tokenContract } = useWeb3();
  const [loading, setLoading] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [votingPower, setVotingPower] = useState(0n);

  const status = getProposalStatus(proposal);

  const totalVotes = proposal.forVotes + proposal.againstVotes;
  const forPercent = totalVotes > 0n ? Number((proposal.forVotes * 100n) / totalVotes) : 0;
  const againstPercent = totalVotes > 0n ? 100 - forPercent : 0;

  const checkVoteStatus = useCallback(async () => {
    if (!daoContract || !account) return;
    try {
      const voted = await daoContract.hasVoted(proposalId, account);
      setHasVoted(voted);

      if (tokenContract) {
        const power = await tokenContract.balanceOfAt(account, proposal.snapshotId);
        setVotingPower(power);
      }
    } catch (e) {
      console.warn("Could not check vote status:", e);
    }
  }, [daoContract, account, proposalId, tokenContract, proposal.snapshotId]);

  useEffect(() => {
    checkVoteStatus();
  }, [checkVoteStatus]);

  const handleVote = async (support) => {
    setLoading(true);
    try {
      const tx = await daoContract.vote(proposalId, support);
      await tx.wait();
      onToast(`Vote ${support ? "FOR" : "AGAINST"} cast successfully!`, "success");
      setHasVoted(true);
    } catch (err) {
      const reason = err?.reason || err?.data?.message || err?.message || "Vote failed";
      onToast(reason, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    setLoading(true);
    try {
      const tx = await daoContract.executeProposal(proposalId);
      await tx.wait();
      onToast("Proposal executed successfully! ⚡", "success");
    } catch (err) {
      const reason = err?.reason || err?.data?.message || err?.message || "Execution failed";
      onToast(reason, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      const tx = await daoContract.cancelProposal(proposalId);
      await tx.wait();
      onToast("Proposal cancelled.", "info");
    } catch (err) {
      const reason = err?.reason || err?.data?.message || err?.message || "Cancel failed";
      onToast(reason, "error");
    } finally {
      setLoading(false);
    }
  };

  const isCreator = account && proposal.creator.toLowerCase() === account.toLowerCase();
  const canCancel =
    isCreator &&
    !proposal.executed &&
    proposal.forVotes === 0n &&
    proposal.againstVotes === 0n;

  const deadlineDate = new Date(Number(proposal.deadline) * 1000);

  return (
    <div className={`proposal-card ${status}`}>
      <div className="proposal-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="proposal-id">#{proposalId.toString()}</span>
          <span className={`proposal-status status-${status}`}>
            {status}
          </span>
        </div>
        {status === "active" && <Countdown deadline={proposal.deadline} />}
      </div>

      <div className="proposal-body">
        <div className="proposal-target">
          <span className="proposal-target-label">Target:</span>
          <span className="proposal-target-addr">{proposal.target}</span>
        </div>

        <div className="proposal-meta">
          <div className="proposal-meta-item">
            <span className="proposal-meta-label">Creator</span>
            <span className="proposal-meta-value" style={{ fontSize: 12 }}>
              {proposal.creator.slice(0, 6)}...{proposal.creator.slice(-4)}
              {isCreator && (
                <span style={{ color: "var(--accent-primary)", marginLeft: 6 }}>(you)</span>
              )}
            </span>
          </div>
          <div className="proposal-meta-item">
            <span className="proposal-meta-label">Deadline</span>
            <span className="proposal-meta-value" style={{ fontSize: 12 }}>
              {deadlineDate.toLocaleString()}
            </span>
          </div>
          <div className="proposal-meta-item">
            <span className="proposal-meta-label">Snapshot ID</span>
            <span className="proposal-meta-value">{proposal.snapshotId.toString()}</span>
          </div>
          <div className="proposal-meta-item">
            <span className="proposal-meta-label">Your Power</span>
            <span className="proposal-meta-value">
              {ethers.formatEther(votingPower)} {" "}
            </span>
          </div>
          {proposal.cid && proposal.cid !== "0" && (
            <div className="proposal-meta-item">
              <span className="proposal-meta-label">Target Source</span>
              <span className="proposal-meta-value">
                <a
                  href={`https://gateway.pinata.cloud/ipfs/${proposal.cid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent-primary)", textDecoration: "underline" }}
                >
                  View on IPFS
                </a>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Vote bar */}
      <div className="vote-bar-container">
        <div className="vote-bar-labels">
          <span className="vote-for">
            For: {ethers.formatEther(proposal.forVotes)}
          </span>
          <span className="vote-against">
            Against: {ethers.formatEther(proposal.againstVotes)}
          </span>
        </div>
        <div className="vote-bar">
          <div
            className="vote-bar-for"
            style={{ width: totalVotes > 0n ? `${forPercent}%` : "0%" }}
          />
          <div
            className="vote-bar-against"
            style={{ width: totalVotes > 0n ? `${againstPercent}%` : "0%" }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="proposal-actions">
        {status === "active" && !hasVoted && votingPower > 0n && (
          <>
            <button
              className="btn btn-success btn-sm"
              onClick={() => handleVote(true)}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : "👍 Vote For"}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => handleVote(false)}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : "👎 Vote Against"}
            </button>
          </>
        )}

        {status === "active" && hasVoted && (
          <span style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 500 }}>
            ✓ You have voted
          </span>
        )}

        {status === "active" && !hasVoted && votingPower === 0n && account && (
          <span style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 500 }}>
            No voting power at snapshot
          </span>
        )}

        {status === "passed" && (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleExecute}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "⚡ Execute"}
          </button>
        )}

        {canCancel && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleCancel}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "✕ Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}
