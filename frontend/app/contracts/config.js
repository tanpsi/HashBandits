// Default values — users can override these in the frontend UI
export const DEFAULT_ADDRESSES = {
  GovernanceToken: "",
  DAO: "",
  MockTarget: "",
};

export const NETWORKS = {
  localhost: {
    key: "localhost",
    chainId: Number(process.env.NEXT_PUBLIC_LOCAL_CHAIN_ID || 31337),
    name: process.env.NEXT_PUBLIC_LOCAL_NETWORK || "Hardhat Local",
    rpcUrl: process.env.NEXT_PUBLIC_LOCAL_RPC_URL || "http://127.0.0.1:8545",
  },
  sepolia: {
    key: "sepolia",
    chainId: Number(process.env.NEXT_PUBLIC_SEPOLIA_CHAIN_ID || 11155111),
    name: process.env.NEXT_PUBLIC_SEPOLIA_NETWORK || "Sepolia",
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
  },
};

const NETWORK_STORAGE_KEY = "dao_active_network";

export function getActiveNetworkKey() {
  if (typeof window === "undefined") return "sepolia";
  try {
    const saved = localStorage.getItem(NETWORK_STORAGE_KEY);
    if (saved && NETWORKS[saved]) return saved;
  } catch {}
  return "sepolia";
}

export function setActiveNetworkKey(key) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NETWORK_STORAGE_KEY, key);
}

export function getActiveNetwork() {
  return NETWORKS[getActiveNetworkKey()];
}

// Convenience exports — these reflect the persisted selection
export function getCHAIN_ID() { return getActiveNetwork().chainId; }
export function getNETWORK_NAME() { return getActiveNetwork().name; }
export function getRPC_URL() { return getActiveNetwork().rpcUrl; }

// Keep static exports for backward-compat (initial load value)
export const CHAIN_ID = NETWORKS["sepolia"].chainId;
export const NETWORK_NAME = NETWORKS["sepolia"].name;
export const RPC_URL = NETWORKS["sepolia"].rpcUrl;

const STORAGE_KEY = "dao_contract_addresses";

export function getSavedAddresses() {
  if (typeof window === "undefined") return DEFAULT_ADDRESSES;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_ADDRESSES;
}

export function saveAddresses(addresses) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
}

export function clearAddresses() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function areAddressesConfigured() {
  const addr = getSavedAddresses();
  return !!(addr.GovernanceToken && addr.DAO && addr.MockTarget);
}
