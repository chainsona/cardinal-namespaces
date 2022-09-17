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

export const DEFAULT_EVENT_CONFIG = "default";

export const eventUrl = (eventShortLink: string, companyId: string | null) => {
  return `https://events.cardinal.so/${
    companyId ?? DEFAULT_EVENT_CONFIG
  }/${eventShortLink}`;
};

export const claimUrl = ({
  eventShortLink,
  config,
  keypair,
  ticketId,
  entryName,
  environment,
}: {
  eventShortLink: string;
  config: string | null;
  keypair: Keypair;
  ticketId: string;
  entryName: string;
  environment: string;
}) => {
  return `https://events.cardinal.so/${
    config ?? DEFAULT_EVENT_CONFIG
  }/${eventShortLink}/claim?otp=${utils.bytes.bs58.encode(
    keypair.secretKey
  )}&ticketId=${ticketId}&entryName=${entryName}${
    environment !== "mainnet" && environment !== "mainnet-beta"
      ? `&cluster=${environment}`
      : ""
  }`;
};
