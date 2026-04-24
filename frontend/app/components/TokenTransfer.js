"use client";
import { useState } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";

export default function TokenTransfer({ onToast }) {
  const { tokenContract, refreshBalance } = useWeb3();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!ethers.isAddress(recipient)) {
      onToast("Invalid address", "error");
      return;
    }
    setLoading(true);
    try {
      const tx = await tokenContract.transfer(
        recipient,
        ethers.parseEther(amount)
      );
      await tx.wait();
      onToast(`Transferred ${amount} GOV to ${recipient.slice(0,6)}...${recipient.slice(-4)}`, "success");
      setRecipient("");
      setAmount("");
      refreshBalance();
    } catch (err) {
      const reason = err?.reason || err?.data?.message || err?.message || "Transfer failed";
      onToast(reason, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>
        💸 Transfer Governance Tokens
      </h3>
      <form onSubmit={handleTransfer}>
        <div className="transfer-row">
          <div className="form-group">
            <label className="form-label">Recipient Address</label>
            <input
              className="form-input mono"
              type="text"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ maxWidth: 160 }}>
            <label className="form-label">Amount</label>
            <input
              className="form-input mono"
              type="number"
              step="0.01"
              min="0"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginBottom: 0 }}>
            {loading ? <span className="spinner" /> : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
