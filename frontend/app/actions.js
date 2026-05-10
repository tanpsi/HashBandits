"use server";

import { PinataSDK } from "pinata";

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
    const file = new File([sourceCode], "source.json", { type: "application/json" });
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
