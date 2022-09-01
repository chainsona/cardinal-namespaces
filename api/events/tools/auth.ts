import type { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";

export const getAuthToken = (keypair: Keypair, data: string): string => {
  const signedData = nacl.sign.detached(Buffer.from(data), keypair.secretKey);
  return Buffer.from(signedData).toString("base64");
};
