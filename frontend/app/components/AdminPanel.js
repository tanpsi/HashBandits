"use client";
import { useState } from "react";
import { useWeb3 } from "../context/Web3Context";

export default function AdminPanel({ onToast }) {
  const { daoContract, isAdmin } = useWeb3();
  const [quorum, setQuorum] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isAdmin) return null;

  const handleSetQuorum = async (e) => {
    e.preventDefault();
    const q = parseInt(quorum);
    if (isNaN(q) || q < 0 || q > 100) {
      onToast("Quorum must be 0-100", "error");
      return;
    }
    setLoading(true);
    try {
      const tx = await daoContract.setQuorumPercent(q);
      await tx.wait();
      onToast(`Quorum updated to ${q}%`, "success");
      setQuorum("");
    } catch (err) {
      const reason = err?.reason || err?.data?.message || err?.message || "Failed";
      onToast(reason, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-badge">⚡ Admin Panel</div>
      <form onSubmit={handleSetQuorum}>
        <div className="admin-row">
          <div className="form-group">
            <label className="form-label">Set Quorum Percentage</label>
            <input
              className="form-input mono"
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 30"
              value={quorum}
              onChange={(e) => setQuorum(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "Update Quorum"}
          </button>
        </div>
      </form>
    </div>
  );
}
