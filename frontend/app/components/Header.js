"use client";
import { useWeb3 } from "../context/Web3Context";
import { NETWORKS } from "../contracts/config";

export default function Header({ onShowConfig, configReady }) {
  const {
    account,
    isConnecting,
    isCorrectNetwork,
    tokenBalance,
    tokenSymbol,
    isAdmin,
    activeNetworkKey,
    connectWallet,
    disconnectWallet,
  } = useWeb3();

  const activeNet = NETWORKS[activeNetworkKey] || NETWORKS["sepolia"];

  const shortAddr = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : "";

  return (
    <header className="header">
      <div className="header-logo">
        <div className="logo-icon">⬡</div>
        <div>
          <div className="logo-text">DAO Governance</div>
          <div className="logo-tag">Decentralized Voting</div>
        </div>
      </div>

      <div className="header-right">
        {/* Config button */}
        {onShowConfig && configReady && (
          <button
            onClick={onShowConfig}
            className="btn btn-ghost btn-sm"
            title="Edit contract addresses"
          >
            ⚙️ Contracts
          </button>
        )}

        {account && (
          <>
            {isCorrectNetwork ? (
              <div className="network-badge connected">
                <span className="network-dot green" />
                {activeNet.name}
              </div>
            ) : (
              <div className="network-badge wrong">
                <span className="network-dot red" />
                Wrong Network
              </div>
            )}

            <div className="wallet-info">
              <span className="wallet-balance">
                {parseFloat(tokenBalance).toLocaleString()} {tokenSymbol}
              </span>
              <span className="wallet-address" title={account}>
                {shortAddr}
              </span>
            </div>

            {isAdmin && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: "var(--accent-primary)",
                  textTransform: "uppercase",
                }}
              >
                ⚡ Admin
              </span>
            )}

            <button onClick={disconnectWallet} className="btn btn-disconnect">
              Disconnect
            </button>
          </>
        )}

        {!account && configReady && (
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="btn btn-connect"
          >
            {isConnecting ? (
              <>
                <span className="spinner" /> Connecting...
              </>
            ) : (
              <>🦊 Connect MetaMask</>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
