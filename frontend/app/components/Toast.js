"use client";
import { useEffect } from "react";

export default function Toast({ message, type = "info", onClose, duration = 5000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className={`toast ${type}`} onClick={onClose} style={{ cursor: "pointer" }}>
      {type === "success" && "✓ "}
      {type === "error" && "✕ "}
      {type === "info" && "ℹ "}
      {message}
    </div>
  );
}
