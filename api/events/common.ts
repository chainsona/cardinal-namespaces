import { tryPublicKey } from "@cardinal/common";
import { utils } from "@project-serum/anchor";
import type { Keypair } from "@solana/web3.js";

export const publicKeyFrom = (
  publicKeyString: string | string[] | null | undefined,
  error?: string
) => {
  const publicKey = tryPublicKey(publicKeyString);
  if (!publicKey) throw error ?? "Invalid publicKey";
  return publicKey;
};

export const eventUrl = (eventShortLink: string, companyId: string) => {
  return `https://events.cardinal.so/${companyId}/${eventShortLink}`;
};

export const claimUrl = (
  eventShortLink: string,
  companyId: string,
  keypair: Keypair,
  ticketId: string,
  entryName: string,
  environment: string
) => {
  `https://events.cardinal.so/${companyId}/${eventShortLink}/claim?otp=${utils.bytes.bs58.encode(
    keypair.secretKey
  )}&ticketId=${ticketId}&entryName=${entryName}
  
  ${
    environment !== "mainnet" && environment !== "mainnet-beta"
      ? `&cluster=${environment}`
      : ""
  }
  `;
};
