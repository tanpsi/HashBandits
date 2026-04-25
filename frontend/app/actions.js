"use server";

import { PinataSDK } from "pinata";
import fs from "fs/promises";
import path from "path";

// Upload source code to IPFS using Pinata
export async function uploadSourceToPinata(sourceCode) {
  if (!sourceCode) return "0";

  if (!process.env.PINATA_JWT || !process.env.PINATA_GATEWAY) {
    throw new Error("Pinata credentials not found in environment variables.");
  }

  const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY,
  });

  try {
    const file = new File([sourceCode], "source.txt", { type: "text/plain" });
    const upload = await pinata.upload.public.file(file);
    return upload.cid || upload.ipfsHash || "0";
  } catch (error) {
    console.error("Pinata upload error:", error);
    throw new Error("Failed to upload source code to Pinata: " + error.message);
  }
}

// Fetch source code from IPFS using Pinata
export async function fetchSourceFromPinata(cid) {
  if (!cid || cid === "0") return null;

  if (!process.env.PINATA_JWT || !process.env.PINATA_GATEWAY) {
    throw new Error("Pinata credentials not found in environment variables.");
  }

  const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY,
  });

  try {
    const result = await pinata.gateways.public.get(cid);
    return result.data || null;
  } catch (error) {
    console.error("Pinata fetch error:", error);
    throw new Error("Failed to fetch source code from Pinata: " + error.message);
  }
}

// Read the local MockTarget.sol contract source for verification
export async function getLocalContractSource() {
  try {
    // Navigate from frontend/app/actions.js -> project root -> contracts/MockTarget.sol
    const projectRoot = path.resolve(process.cwd(), "..");
    const contractPath = path.join(projectRoot, "contracts", "MockTarget.sol");
    const source = await fs.readFile(contractPath, "utf-8");
    return source;
  } catch (error) {
    console.error("Failed to read local contract source:", error);
    throw new Error("Failed to read local contract source: " + error.message);
  }
}
