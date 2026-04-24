"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { getSavedAddresses, saveAddresses, clearAddresses, CHAIN_ID, NETWORK_NAME, RPC_URL } from "../contracts/config";

export default function ContractConfig({ onConfigured }) {
  const [addresses, setAddresses] = useState({
    GovernanceToken: "",
    DAO: "",
    MockTarget: "",
  });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  // MetaMask state
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [mmStatus, setMmStatus] = useState(""); // status message
  const [mmAccount, setMmAccount] = useState(null);
  const [mmChainOk, setMmChainOk] = useState(false);

  // Check MetaMask on mount
  useEffect(() => {
    const hasMM = typeof window !== "undefined" && !!window.ethereum;
    setHasMetaMask(hasMM);
    if (hasMM) {
      checkMetaMaskState();
    }
  }, []);

  const checkMetaMaskState = async () => {
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        setMmAccount(accounts[0]);
      }
      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
      setMmChainOk(parseInt(chainIdHex, 16) === CHAIN_ID);
    } catch {}
  };

  // Load saved addresses on mount
  useEffect(() => {
    const loaded = getSavedAddresses();
    if (loaded.GovernanceToken || loaded.DAO || loaded.MockTarget) {
      setAddresses(loaded);
    }
  }, []);

  const validate = () => {
    const errs = {};
    if (!ethers.isAddress(addresses.GovernanceToken)) {
      errs.GovernanceToken = "Invalid Ethereum address";
    }
    if (!ethers.isAddress(addresses.DAO)) {
      errs.DAO = "Invalid Ethereum address";
    }
    if (!ethers.isAddress(addresses.MockTarget)) {
      errs.MockTarget = "Invalid Ethereum address";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!validate()) return;

    saveAddresses(addresses);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (onConfigured) onConfigured();
  };

  const handleClear = () => {
    clearAddresses();
    setAddresses({ GovernanceToken: "", DAO: "", MockTarget: "" });
    setErrors({});
    if (onConfigured) onConfigured();
  };

  const handleChange = (key, value) => {
    setAddresses((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // ===== MetaMask actions =====
  const addHardhatNetwork = async () => {
    setMmStatus("");
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x" + CHAIN_ID.toString(16),
          chainName: NETWORK_NAME,
          rpcUrls: [RPC_URL],
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        }],
      });
      setMmChainOk(true);
      setMmStatus("✓ Hardhat network added!");
    } catch (err) {
      if (err.code === 4001) {
        setMmStatus("User rejected the request");
      } else {
        setMmStatus(err.message || "Failed to add network");
      }
    }
  };

  const switchToHardhat = async () => {
    setMmStatus("");
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + CHAIN_ID.toString(16) }],
      });
      setMmChainOk(true);
      setMmStatus("✓ Switched to Hardhat network!");
    } catch (err) {
      if (err.code === 4902) {
        // Chain not added yet, add it
        await addHardhatNetwork();
      } else if (err.code === 4001) {
        setMmStatus("User rejected the request");
      } else {
        setMmStatus(err.message || "Failed to switch network");
      }
    }
  };

  const requestAccounts = async () => {
    setMmStatus("");
    try {
      // wallet_requestPermissions forces the MetaMask account picker to open
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        setMmAccount(accounts[0]);
        setMmStatus(`✓ Connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
      }
    } catch (err) {
      if (err.code === 4001) {
        setMmStatus("User rejected the request");
      } else {
        setMmStatus(err.message || "Failed to connect");
      }
    }
  };

  const fields = [
    {
      key: "GovernanceToken",
      label: "GovernanceToken Address",
      hint: "ERC20 token with snapshot capability",
      icon: "🪙",
    },
    {
      key: "DAO",
      label: "DAO Contract Address",
      hint: "Main governance contract",
      icon: "⬡",
    },
    {
      key: "MockTarget",
      label: "MockTarget Address",
      hint: "Demo target contract for proposals",
      icon: "🎯",
    },
  ];

  return (
    <div className="config-container">
      <div className="config-card">
        {/* ===== Step 1: MetaMask Setup ===== */}
        <div className="config-section">
          <div className="config-step-badge">Step 1</div>
          <h3 className="config-section-title">🦊 Configure MetaMask</h3>
          <p className="config-section-desc">
            Set up MetaMask to connect to your local Hardhat network.
          </p>

          {!hasMetaMask ? (
            <div className="mm-warning">
              <span>⚠️</span>
              MetaMask not detected.{" "}
              <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="mm-link">
                Install MetaMask
              </a>
            </div>
          ) : (
            <div className="mm-actions">
              <div className="mm-row">
                <div className="mm-row-info">
                  <span className="mm-row-label">Network</span>
                  <span className="mm-row-value">
                    {mmChainOk ? (
                      <span className="mm-ok">● Hardhat Local</span>
                    ) : (
                      <span className="mm-not">● Not connected</span>
                    )}
                  </span>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={switchToHardhat}
                  type="button"
                >
                  {mmChainOk ? "Re-add Network" : "Add & Switch"}
                </button>
              </div>

              <div className="mm-row">
                <div className="mm-row-info">
                  <span className="mm-row-label">Account</span>
                  <span className="mm-row-value">
                    {mmAccount ? (
                      <span className="mm-addr">{mmAccount.slice(0, 6)}...{mmAccount.slice(-4)}</span>
                    ) : (
                      <span className="mm-not">No account</span>
                    )}
                  </span>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={requestAccounts}
                  type="button"
                >
                  {mmAccount ? "Switch Account" : "Connect"}
                </button>
              </div>

              {mmStatus && (
                <div className={`mm-status ${mmStatus.startsWith("✓") ? "mm-status-ok" : "mm-status-err"}`}>
                  {mmStatus}
                </div>
              )}

              <div className="mm-tip">
                <strong>💡 Tip:</strong> Import a Hardhat test account in MetaMask via{" "}
                <em>Import Account → Private Key</em>. Use the keys shown when you run{" "}
                <code className="config-code-inline">npx hardhat node</code>.
              </div>
            </div>
          )}
        </div>

        <div className="config-divider" />

        {/* ===== Step 2: Contract Addresses ===== */}
        <div className="config-section">
          <div className="config-step-badge">Step 2</div>
          <h3 className="config-section-title">📋 Contract Addresses</h3>
          <p className="config-section-desc">
            Paste addresses from{" "}
            <code className="config-code-inline">
              npx hardhat run scripts/deploy.js --network localhost
            </code>
          </p>

          <form onSubmit={handleSave}>
            {fields.map((field) => (
              <div className="form-group" key={field.key}>
                <label className="form-label">
                  <span style={{ marginRight: 6 }}>{field.icon}</span>
                  {field.label}
                </label>
                <input
                  className={`form-input mono ${errors[field.key] ? "form-input-error" : ""}`}
                  type="text"
                  placeholder="0x..."
                  value={addresses[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
                {errors[field.key] ? (
                  <div className="form-error">{errors[field.key]}</div>
                ) : (
                  <div className="form-hint">{field.hint}</div>
                )}
              </div>
            ))}

            <div className="config-actions">
              <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                {saved ? "✓ Saved!" : "💾 Save & Continue"}
              </button>
              {(addresses.GovernanceToken || addresses.DAO || addresses.MockTarget) && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleClear}
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .config-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 80vh;
          padding: 24px 0;
        }

        .config-card {
          background: var(--bg-card);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-xl);
          padding: 40px;
          max-width: 560px;
          width: 100%;
          position: relative;
          overflow: hidden;
        }

        .config-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(135deg, #f59e0b, #f97316, #ef4444);
        }

        .config-section {
          position: relative;
        }

        .config-step-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--accent-secondary);
          padding: 3px 10px;
          background: rgba(167, 139, 250, 0.1);
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 999px;
          margin-bottom: 12px;
        }

        .config-section-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .config-section-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .config-divider {
          height: 1px;
          background: var(--border-primary);
          margin: 28px 0;
        }

        .config-code-inline {
          background: var(--bg-input);
          border: 1px solid var(--border-primary);
          border-radius: 4px;
          padding: 1px 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--accent-secondary);
        }

        .config-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        /* MetaMask section */
        .mm-warning {
          padding: 12px 16px;
          background: var(--warning-bg);
          border: 1px solid var(--warning-border);
          border-radius: var(--radius-md);
          color: var(--warning);
          font-size: 13px;
        }

        .mm-link {
          color: var(--accent-primary);
          text-decoration: underline;
        }

        .mm-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mm-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-input);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-md);
        }

        .mm-row-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .mm-row-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .mm-row-value {
          font-size: 13px;
          font-weight: 500;
        }

        .mm-ok {
          color: var(--success);
        }

        .mm-not {
          color: var(--text-muted);
        }

        .mm-addr {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--text-accent);
        }

        .mm-status {
          font-size: 12px;
          font-weight: 500;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
        }

        .mm-status-ok {
          background: var(--success-bg);
          border: 1px solid var(--success-border);
          color: var(--success);
        }

        .mm-status-err {
          background: var(--danger-bg);
          border: 1px solid var(--danger-border);
          color: var(--danger);
        }

        .mm-tip {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.6;
          padding: 10px 14px;
          background: rgba(108, 99, 255, 0.05);
          border: 1px solid rgba(108, 99, 255, 0.1);
          border-radius: var(--radius-sm);
        }

        .mm-tip strong {
          color: var(--text-secondary);
        }

        .mm-tip em {
          color: var(--text-accent);
          font-style: normal;
        }

        .form-input-error {
          border-color: var(--danger) !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15) !important;
        }

        .form-error {
          font-size: 12px;
          color: var(--danger);
          margin-top: 6px;
        }

        @media (max-width: 600px) {
          .mm-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  );
}
