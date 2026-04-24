// Default values — users can override these in the frontend UI
export const DEFAULT_ADDRESSES = {
  GovernanceToken: "",
  DAO: "",
  MockTarget: "",
};

export const CHAIN_ID = 31337;
export const NETWORK_NAME = "Hardhat Local";
export const RPC_URL = "http://127.0.0.1:8545";

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
