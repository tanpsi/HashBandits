"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { fetchSourceFromPinata } from "../actions";

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


const EXECUTION_DELAY = 30; // Must match DAO.sol EXECUTION_DELAY (30 seconds)

function ExecuteSection({ proposal, loading, onExecute }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [canExecute, setCanExecute] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const executeAfter = Number(proposal.deadline) + EXECUTION_DELAY;
      const diff = executeAfter - now;

      if (diff <= 0) {
        setCanExecute(true);
        setTimeLeft(null);
      } else {
        setCanExecute(false);
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        setTimeLeft(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [proposal.deadline]);

  if (!canExecute) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn btn-primary btn-sm" disabled style={{ opacity: 0.5 }}>
          ⏳ Timelock
        </button>
        <span
          className="countdown active"
          style={{
            fontSize: 12,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        >
          Executable in {timeLeft}
        </span>
      </div>
    );
  }

  return (
    <button
      className="btn btn-primary btn-sm"
      onClick={onExecute}
      disabled={loading}
      style={{
        boxShadow: "0 0 12px rgba(99, 102, 241, 0.4)",
        animation: "pulse 2s ease-in-out infinite",
      }}
    >
      {loading ? <span className="spinner" /> : "⚡ Execute Proposal"}
    </button>
  );
}

export default function ProposalCard({ proposalId, proposal, onToast }) {
  const { daoContract, account, tokenContract } = useWeb3();
  const [loading, setLoading] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [votingPower, setVotingPower] = useState(0n);

  const [sourceCode, setSourceCode] = useState(null);
  const [loadingSource, setLoadingSource] = useState(false);

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

  const handleFetchSource = async () => {
    if (sourceCode) {
      setSourceCode(null); // toggle off
      return;
    }
    setLoadingSource(true);
    try {
      const code = await fetchSourceFromPinata(proposal.cid);
      let parsedCode = code;
      if (typeof code === 'string') {
        try {
          parsedCode = JSON.parse(code);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
      setSourceCode(parsedCode);
    } catch (err) {
      onToast("Failed to fetch source code from IPFS", "error");
    } finally {
      setLoadingSource(false);
    }
  };

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
            <div className="proposal-meta-item" style={{ alignItems: "flex-start", gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                <span className="proposal-meta-label">Target Source</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleFetchSource}
                  disabled={loadingSource}
                  style={{ fontSize: 12, padding: "4px 8px" }}
                >
                  {loadingSource ? <span className="spinner" /> : sourceCode ? "Hide Source" : "Fetch Source"}
                </button>
              </div>
              {sourceCode && (
                <div style={{ marginTop: 16, width: "100%", animation: "fadeIn 0.3s ease-out", marginBottom: 8 }}>
                  {typeof sourceCode === 'object' ? (
                    <div style={{ 
                      background: "rgba(255, 255, 255, 0.02)", 
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "12px", 
                      overflow: "hidden" 
                    }}>
                      <div style={{ 
                        padding: "16px", 
                        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                        display: "grid", 
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
                        gap: "16px" 
                      }}>
                        {sourceCode.contractName && (
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Contract Name</div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{sourceCode.contractName}</div>
                          </div>
                        )}
                        {sourceCode.contractAddress && (
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Address</div>
                            <div className="mono" style={{ fontSize: 13, color: "var(--text)", wordBreak: "break-all" }}>{sourceCode.contractAddress}</div>
                          </div>
                        )}
                        {sourceCode.compilerVersion && (
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Compiler</div>
                            <div style={{ display: "inline-block", background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", padding: "2px 8px", borderRadius: "12px", fontSize: 12, fontWeight: 500 }}>
                              {sourceCode.compilerVersion}
                            </div>
                          </div>
                        )}
                        {sourceCode.evmVersion && (
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>EVM Version</div>
                            <div style={{ display: "inline-block", background: "rgba(255, 255, 255, 0.1)", color: "var(--text-accent)", padding: "2px 8px", borderRadius: "12px", fontSize: 12 }}>
                              {sourceCode.evmVersion}
                            </div>
                          </div>
                        )}
                        {sourceCode.optimizationUsed !== undefined && (
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Optimization</div>
                            <div style={{ 
                              display: "inline-block", 
                              background: sourceCode.optimizationUsed ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", 
                              color: sourceCode.optimizationUsed ? "#34d399" : "#f87171", 
                              padding: "2px 8px", 
                              borderRadius: "12px", 
                              fontSize: 12,
                              fontWeight: 500
                            }}>
                              {sourceCode.optimizationUsed ? "Yes" : "No"}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {sourceCode.sourceCode && (
                        <div style={{ padding: "16px", background: "rgba(0, 0, 0, 0.3)" }}>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Source Code</div>
                          <div style={{ overflowX: "auto" }}>
                            <pre style={{ 
                              margin: 0, 
                              fontSize: 12, 
                              fontFamily: "'JetBrains Mono', monospace", 
                              color: "var(--text-accent)", 
                              whiteSpace: "pre-wrap" 
                            }}>
                              {sourceCode.sourceCode}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: "rgba(0,0,0,0.3)", padding: 16, borderRadius: 12, overflowX: "auto", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <pre style={{ margin: 0, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "var(--text-accent)", whiteSpace: "pre-wrap" }}>
                        {sourceCode}
                      </pre>
                    </div>
                  )}
                </div>
              )}
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
              {loading ? <span className="spinner" /> : "Vote For"}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => handleVote(false)}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : "Vote Against"}
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
          <ExecuteSection
            proposal={proposal}
            loading={loading}
            onExecute={handleExecute}
          />
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
