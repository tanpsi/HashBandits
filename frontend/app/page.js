"use client";
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "./context/Web3Context";
import { areAddressesConfigured, getSavedAddresses } from "./contracts/config";
import Header from "./components/Header";
import ProposalCard from "./components/ProposalCard";
import ProposalForm from "./components/ProposalForm";
import AdminPanel from "./components/AdminPanel";
import TokenTransfer from "./components/TokenTransfer";
import ContractConfig from "./components/ContractConfig";
import Toast from "./components/Toast";

export default function Home() {
  const {
    account,
    daoContract,
    tokenContract,
    mockTargetContract,
    isConnecting,
    error,
    tokenBalance,
    tokenSymbol,
    connectWallet,
  } = useWeb3();

  const [proposals, setProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configReady, setConfigReady] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [toast, setToast] = useState({ message: "", type: "info" });

  // DAO stats
  const [quorum, setQuorum] = useState(0);
  const [totalSupply, setTotalSupply] = useState("0");
  const [mockValue, setMockValue] = useState("0");

  // Check if addresses are configured on mount
  useEffect(() => {
    setConfigReady(areAddressesConfigured());
  }, []);

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
  }, []);

  const fetchProposals = useCallback(async () => {
    if (!daoContract) return;
    setLoadingProposals(true);
    try {
      const allProposals = [];
      let i = 0;
      while (true) {
        try {
          const p = await daoContract.proposals(i);
          allProposals.push({
            target: p.target,
            data: p.data,
            snapshotId: p.snapshotId,
            deadline: p.deadline,
            forVotes: p.forVotes,
            againstVotes: p.againstVotes,
            executed: p.executed,
            creator: p.creator,
          });
          i++;
        } catch {
          break;
        }
      }
      setProposals(allProposals);
    } catch (err) {
      console.error("Error fetching proposals:", err);
    } finally {
      setLoadingProposals(false);
    }
  }, [daoContract]);

  const fetchStats = useCallback(async () => {
    if (!daoContract || !tokenContract) return;
    try {
      const q = await daoContract.quorumPercent();
      setQuorum(Number(q));
      const supply = await tokenContract.totalSupply();
      setTotalSupply(ethers.formatEther(supply));
    } catch (err) {
      console.warn("Error fetching stats:", err);
    }
    if (mockTargetContract) {
      try {
        const val = await mockTargetContract.value();
        setMockValue(val.toString());
      } catch {}
    }
  }, [daoContract, tokenContract, mockTargetContract]);

  useEffect(() => {
    fetchProposals();
    fetchStats();
  }, [fetchProposals, fetchStats]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!daoContract) return;
    const interval = setInterval(() => {
      fetchProposals();
      fetchStats();
    }, 10000);
    return () => clearInterval(interval);
  }, [daoContract, fetchProposals, fetchStats]);

  const handleFormSuccess = (successMsg, errorMsg) => {
    if (successMsg) {
      showToast(successMsg, "success");
      fetchProposals();
      fetchStats();
    }
    if (errorMsg) {
      showToast(errorMsg, "error");
    }
  };

  const handleCardToast = (message, type) => {
    showToast(message, type);
    setTimeout(() => {
      fetchProposals();
      fetchStats();
    }, 2000);
  };

  const handleConfigured = () => {
    const ready = areAddressesConfigured();
    setConfigReady(ready);
    setShowConfig(false);
    if (ready) {
      showToast("Contract addresses saved! You can now connect.", "success");
    }
  };

  // Filter proposals
  const getStatus = (p) => {
    if (p.executed && p.forVotes === 0n && p.againstVotes === 0n) return "cancelled";
    if (p.executed) return "executed";
    const now = Math.floor(Date.now() / 1000);
    if (now < Number(p.deadline)) return "active";
    if (p.forVotes > p.againstVotes && p.forVotes > 0n) return "passed";
    return "failed";
  };

  const filteredProposals = proposals.filter((p) => {
    if (activeTab === "all") return true;
    return getStatus(p) === activeTab;
  });

  const activeCnt = proposals.filter((p) => getStatus(p) === "active").length;
  const passedCnt = proposals.filter(
    (p) => getStatus(p) === "passed" || getStatus(p) === "executed"
  ).length;

  // Config screen — shown when addresses not set
  if (!configReady || showConfig) {
    return (
      <div className="app-container">
        <Header onShowConfig={() => setShowConfig(true)} configReady={configReady} />
        <ContractConfig onConfigured={handleConfigured} />
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: "", type: "info" })}
        />
      </div>
    );
  }

  // Not connected screen
  if (!account) {
    const savedAddr = getSavedAddresses();
    return (
      <div className="app-container">
        <Header onShowConfig={() => setShowConfig(true)} configReady={configReady} />
        <div className="connect-screen">
          <div className="connect-card">
            <div className="connect-icon">⬡</div>
            <h1 className="connect-title">DAO Governance</h1>
            <p className="connect-desc">
              Connect your MetaMask wallet to participate in on-chain governance.
              Create proposals, vote with your governance tokens, and help shape
              the future of this DAO.
            </p>

            {/* Show configured addresses */}
            <div style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-primary)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              marginBottom: 24,
              textAlign: "left",
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                📋 Configured Contracts
              </div>
              {[
                { label: "Token", addr: savedAddr.GovernanceToken },
                { label: "DAO", addr: savedAddr.DAO },
                { label: "Target", addr: savedAddr.MockTarget },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{item.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--text-accent)", fontSize: 11 }}>
                    {item.addr.slice(0, 8)}...{item.addr.slice(-6)}
                  </span>
                </div>
              ))}
              <button
                onClick={() => setShowConfig(true)}
                style={{
                  marginTop: 8,
                  background: "none",
                  border: "none",
                  color: "var(--accent-primary)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                ✏️ Edit addresses
              </button>
            </div>

            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="btn btn-connect btn-lg"
              style={{ width: "100%" }}
            >
              {isConnecting ? (
                <>
                  <span className="spinner" /> Connecting...
                </>
              ) : (
                <>🦊 Connect MetaMask</>
              )}
            </button>
            {error && <div className="connect-error">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header onShowConfig={() => setShowConfig(true)} configReady={configReady} />

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-label">Total Proposals</div>
          <div className="stat-value">{proposals.length}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Active Voting</div>
          <div className="stat-value success">{activeCnt}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Quorum</div>
          <div className="stat-value warning">{quorum}%</div>
          <div className="stat-sub">
            {((parseFloat(totalSupply) * quorum) / 100).toLocaleString()} {tokenSymbol} needed
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-label">Your Balance</div>
          <div className="stat-value info">
            {parseFloat(tokenBalance).toLocaleString()}
          </div>
          <div className="stat-sub">{tokenSymbol}</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-label">MockTarget Value</div>
          <div className="stat-value">{mockValue}</div>
          <div className="stat-sub">Updated by executed proposals</div>
        </div>
      </div>

      {/* Admin Panel */}
      <AdminPanel onToast={showToast} />

      {/* Token Transfer */}
      <TokenTransfer onToast={showToast} />

      {/* Proposals Section */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Proposals</h2>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            ✨ New Proposal
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All ({proposals.length})
          </button>
          <button
            className={`tab ${activeTab === "active" ? "active" : ""}`}
            onClick={() => setActiveTab("active")}
          >
            Active ({activeCnt})
          </button>
          <button
            className={`tab ${activeTab === "passed" ? "active" : ""}`}
            onClick={() => setActiveTab("passed")}
          >
            Passed
          </button>
          <button
            className={`tab ${activeTab === "executed" ? "active" : ""}`}
            onClick={() => setActiveTab("executed")}
          >
            Executed ({passedCnt})
          </button>
          <button
            className={`tab ${activeTab === "failed" ? "active" : ""}`}
            onClick={() => setActiveTab("failed")}
          >
            Failed
          </button>
        </div>

        {loadingProposals ? (
          <div className="loading-overlay">
            <span className="spinner" style={{ width: 24, height: 24 }} />
            Loading proposals...
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">No proposals found</div>
            <div className="empty-desc">
              {activeTab === "all"
                ? "Create the first proposal to get started with governance."
                : `No ${activeTab} proposals at the moment.`}
            </div>
          </div>
        ) : (
          <div className="proposals-list">
            {filteredProposals
              .map((p, i) => {
                const originalIdx = proposals.indexOf(p);
                return (
                  <ProposalCard
                    key={originalIdx}
                    proposalId={BigInt(originalIdx)}
                    proposal={p}
                    onToast={handleCardToast}
                  />
                );
              })
              .reverse()}
          </div>
        )}
      </div>

      {/* Proposal Form Modal */}
      {showForm && (
        <ProposalForm
          onClose={() => setShowForm(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "info" })}
      />
    </div>
  );
}
