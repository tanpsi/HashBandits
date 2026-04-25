"use client";
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { getSavedAddresses, getActiveNetworkKey, getActiveNetwork, NETWORKS } from "../contracts/config";
import { DAO_ABI, TOKEN_ABI, MOCK_TARGET_ABI } from "../contracts/abis";

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [daoContract, setDaoContract] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);
  const [mockTargetContract, setMockTargetContract] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [tokenBalance, setTokenBalance] = useState("0");
  const [tokenSymbol, setTokenSymbol] = useState("GOV");
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeNetworkKey, setActiveNetworkKey] = useState("sepolia");

  // Hydrate from localStorage on mount
  useEffect(() => {
    setActiveNetworkKey(getActiveNetworkKey());
  }, []);

  const activeNet = NETWORKS[activeNetworkKey] || NETWORKS["sepolia"];
  const isCorrectNetwork = chainId === activeNet.chainId;

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to use this dApp.");
      return;
    }

    const addresses = getSavedAddresses();
    if (!addresses.GovernanceToken || !addresses.DAO || !addresses.MockTarget) {
      setError("Please configure contract addresses first.");
      return;
    }

    const net = getActiveNetwork();

    setIsConnecting(true);
    setError(null);

    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      const network = await browserProvider.getNetwork();
      const currentChainId = Number(network.chainId);
      setChainId(currentChainId);

      if (currentChainId !== net.chainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x" + net.chainId.toString(16) }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0x" + net.chainId.toString(16),
                chainName: net.name,
                rpcUrls: [net.rpcUrl],
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              }],
            });
          } else {
            throw switchError;
          }
        }
        const updatedProvider = new ethers.BrowserProvider(window.ethereum);
        const updatedNetwork = await updatedProvider.getNetwork();
        setChainId(Number(updatedNetwork.chainId));
      }

      const newProvider = new ethers.BrowserProvider(window.ethereum);
      const newSigner = await newProvider.getSigner();
      const address = accounts[0];

      const dao = new ethers.Contract(addresses.DAO, DAO_ABI, newSigner);
      const token = new ethers.Contract(addresses.GovernanceToken, TOKEN_ABI, newSigner);
      const mock = new ethers.Contract(addresses.MockTarget, MOCK_TARGET_ABI, newSigner);

      setProvider(newProvider);
      setSigner(newSigner);
      setAccount(address);
      setDaoContract(dao);
      setTokenContract(token);
      setMockTargetContract(mock);

      // Fetch token info
      try {
        const balance = await token.balanceOf(address);
        setTokenBalance(ethers.formatEther(balance));
        const sym = await token.symbol();
        setTokenSymbol(sym);
        const adminRole = await dao.ADMIN_ROLE();
        const hasAdmin = await dao.hasRole(adminRole, address);
        setIsAdmin(hasAdmin);
      } catch (e) {
        console.warn("Could not fetch token info:", e);
      }
    } catch (err) {
      console.error("Connection error:", err);
      setError(err.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }, [activeNetworkKey]);

  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setDaoContract(null);
    setTokenContract(null);
    setMockTargetContract(null);
    setTokenBalance("0");
    setIsAdmin(false);
    setChainId(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (tokenContract && account) {
      try {
        const balance = await tokenContract.balanceOf(account);
        setTokenBalance(ethers.formatEther(balance));
      } catch (e) {
        console.warn("Could not refresh balance:", e);
      }
    }
  }, [tokenContract, account]);

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        connectWallet();
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [connectWallet, disconnectWallet]);

  return (
    <Web3Context.Provider
      value={{
        account,
        provider,
        signer,
        daoContract,
        tokenContract,
        mockTargetContract,
        isConnecting,
        error,
        chainId,
        isCorrectNetwork,
        tokenBalance,
        tokenSymbol,
        isAdmin,
        activeNetworkKey,
        setActiveNetworkKey,
        connectWallet,
        disconnectWallet,
        refreshBalance,
        setError,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used within Web3Provider");
  return ctx;
}
