"use client";
import { useState } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { getSavedAddresses } from "../contracts/config";
import { MOCK_TARGET_ABI } from "../contracts/abis";
import { uploadSourceToPinata } from "../actions";

export default function ProposalForm({ onClose, onSuccess }) {
  const { daoContract } = useWeb3();
  const [loading, setLoading] = useState(false);
  const [formType, setFormType] = useState("mock"); // "mock" or "custom"

  // Mock target form
  const [mockValue, setMockValue] = useState("");
  const [votingHours, setVotingHours] = useState("1");

  // Custom form
  const [targetAddress, setTargetAddress] = useState("");
  const [calldata, setCalldata] = useState("");
  const [customDeadline, setCustomDeadline] = useState("");

  // Target Source Code Details
  const [detailsContractAddress, setDetailsContractAddress] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [contractName, setContractName] = useState("");
  const [compilerVersion, setCompilerVersion] = useState("");
  const [optimizationUsed, setOptimizationUsed] = useState(false);
  const [evmVersion, setEvmVersion] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let target, data, deadline;

      if (formType === "mock") {
        target = getSavedAddresses().MockTarget;
        const iface = new ethers.Interface(MOCK_TARGET_ABI);
        data = iface.encodeFunctionData("setValue", [parseInt(mockValue)]);
        const now = Math.floor(Date.now() / 1000);
        deadline = now + Math.floor(parseFloat(votingHours) * 3600);
      } else {
        target = targetAddress;
        data = calldata.startsWith("0x") ? calldata : "0x" + calldata;
        deadline = Math.floor(new Date(customDeadline).getTime() / 1000);
      }

      let cid = "0";
      if (sourceCode && sourceCode.trim() !== "") {
        const details = {
          contractAddress: detailsContractAddress,
          contractName,
          compilerVersion,
          optimizationUsed,
          evmVersion,
          sourceCode
        };
        cid = await uploadSourceToPinata(JSON.stringify(details, null, 2));
      }

      const tx = await daoContract.createProposal(target, data, deadline, cid);
      const receipt = await tx.wait();

      // Parse the ProposalCreated event to get the ID
      let proposalId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = daoContract.interface.parseLog(log);
          if (parsed && parsed.name === "ProposalCreated") {
            proposalId = parsed.args.id;
            break;
          }
        } catch (_) { }
      }

      onSuccess(
        `Proposal #${proposalId !== null ? proposalId.toString() : "?"} created successfully!`
      );
      onClose();
    } catch (err) {
      console.error(err);
      const reason =
        err?.reason || err?.data?.message || err?.message || "Transaction failed";
      onSuccess(null, reason);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">✨ Create New Proposal</h2>

        <div className="tabs" style={{ marginBottom: 20 }}>
          <button
            className={`tab ${formType === "mock" ? "active" : ""}`}
            onClick={() => setFormType("mock")}
            type="button"
          >
            🎯 MockTarget
          </button>
          <button
            className={`tab ${formType === "custom" ? "active" : ""}`}
            onClick={() => setFormType("custom")}
            type="button"
          >
            ⚙️ Custom Call
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {formType === "mock" ? (
            <>
              <div className="form-group">
                <label className="form-label">Value to Set</label>
                <input
                  className="form-input mono"
                  type="number"
                  placeholder="e.g. 42"
                  value={mockValue}
                  onChange={(e) => setMockValue(e.target.value)}
                  required
                  min="0"
                />
                <div className="form-hint">
                  This will call MockTarget.setValue({mockValue || "?"}) on execution
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Voting Duration (hours)</label>
                <select
                  className="form-input"
                  value={votingHours}
                  onChange={(e) => setVotingHours(e.target.value)}
                >
                  <option value="0.0028">~10 seconds (testing)</option>
                  <option value="0.0167">~1 minute (testing)</option>
                  <option value="0.0833">~5 minutes</option>
                  <option value="0.5">30 minutes</option>
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Target Contract Address</label>
                <input
                  className="form-input mono"
                  type="text"
                  placeholder="0x..."
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  required
                  pattern="^0x[a-fA-F0-9]{40}$"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Calldata (hex)</label>
                <input
                  className="form-input mono"
                  type="text"
                  placeholder="0x..."
                  value={calldata}
                  onChange={(e) => setCalldata(e.target.value)}
                  required
                />
                <div className="form-hint">
                  ABI-encoded function call data
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Deadline</label>
                <input
                  className="form-input"
                  type="datetime-local"
                  value={customDeadline}
                  onChange={(e) => setCustomDeadline(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="form-group" style={{ 
            marginTop: "24px", 
            padding: "20px", 
            background: "rgba(255, 255, 255, 0.03)", 
            borderRadius: "12px", 
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "inset 0 2px 10px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{ marginBottom: "20px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "12px" }}>
              <label className="form-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", color: "var(--text)" }}>
                🛡️ Contract Verification Details
              </label>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                Provide these details to verify and upload the contract source to IPFS.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label" style={{ fontSize: "12px", color: "var(--text-accent)" }}>Contract Address</label>
                <input
                  className="form-input mono"
                  placeholder="e.g. 0x..."
                  value={detailsContractAddress}
                  onChange={(e) => setDetailsContractAddress(e.target.value)}
                  required
                  style={{ background: "rgba(0,0,0,0.2)" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "12px", color: "var(--text-accent)" }}>Contract Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. MyContract"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  required
                  style={{ background: "rgba(0,0,0,0.2)" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "12px", color: "var(--text-accent)" }}>Compiler Version</label>
                <input
                  className="form-input"
                  placeholder="e.g. v0.8.20"
                  value={compilerVersion}
                  onChange={(e) => setCompilerVersion(e.target.value)}
                  required
                  style={{ background: "rgba(0,0,0,0.2)" }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "12px", color: "var(--text-accent)" }}>EVM Version</label>
                <input
                  className="form-input"
                  placeholder="e.g. paris, london, default"
                  value={evmVersion}
                  onChange={(e) => setEvmVersion(e.target.value)}
                  required
                  style={{ background: "rgba(0,0,0,0.2)" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", height: "100%" }}>
                <div 
                  style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)", background: "rgba(0,0,0,0.2)", padding: "0 16px", height: "42px", borderRadius: "8px", width: "100%", cursor: "pointer", border: "1px solid rgba(255, 255, 255, 0.05)", transition: "all 0.2s ease" }} 
                  onClick={() => setOptimizationUsed(!optimizationUsed)}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.2)"}
                >
                  <input
                    type="checkbox"
                    id="optimization"
                    checked={optimizationUsed}
                    onChange={(e) => setOptimizationUsed(e.target.checked)}
                    style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "var(--accent-primary)" }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <label htmlFor="optimization" style={{ cursor: "pointer", fontSize: "13px", fontWeight: 500, margin: 0 }}>Optimization Used</label>
                </div>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label className="form-label" style={{ fontSize: "12px", color: "var(--text-accent)" }}>Source Code</label>
                <textarea
                  className="form-input mono"
                  placeholder="Paste the verified source code here..."
                  value={sourceCode}
                  onChange={(e) => setSourceCode(e.target.value)}
                  rows={4}
                  style={{ resize: "vertical", minHeight: "120px", background: "rgba(0,0,0,0.2)" }}
                  required
                />
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Creating...
                </>
              ) : (
                "Create Proposal"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
