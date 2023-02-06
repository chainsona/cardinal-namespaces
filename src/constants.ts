import type { ParsedIdlAccountData } from "@cardinal/common";
import { emptyWallet } from "@cardinal/common";
import { AnchorProvider, Program } from "@project-serum/anchor";
import type { Wallet } from "@project-serum/anchor/dist/cjs/provider";
import type { ConfirmOptions, Connection } from "@solana/web3.js";
import { Keypair, PublicKey } from "@solana/web3.js";

import * as NAMESPACES_TYPES from "./idl/cardinal_namespaces";

export const NAMESPACES_PROGRAM_ID = new PublicKey(
  "nameXpT2PwZ2iA6DTNYTotTmiMYusBCYqwBLN2QgF4w"
);

export const METADATA_CONFIG_SEED = "metadata-config";

export type NAMESPACES_PROGRAM = NAMESPACES_TYPES.Namespaces;

export const NAMESPACES_IDL = NAMESPACES_TYPES.IDL;

export type GlobalContextData = ParsedIdlAccountData<
  "globalContext",
  NAMESPACES_PROGRAM
>;

export type NamespaceData = ParsedIdlAccountData<
  "namespace",
  NAMESPACES_PROGRAM
>;

export type EntryData = ParsedIdlAccountData<"entry", NAMESPACES_PROGRAM>;

export type ReverseEntryData = ParsedIdlAccountData<
  "reverseEntry",
  NAMESPACES_PROGRAM
>;

export type ClaimRequestData = ParsedIdlAccountData<
  "claimRequest",
  NAMESPACES_PROGRAM
>;

export const DEFAULT_PAYMENT_MANAGER = "cardinal";
export const IDENTITIES = [
  "twitter",
  "discord",
  "github",
  "spotify",
  "instagram",
];

export const GLOBAL_RENTAL_PERCENTAGE = 0.2;
export const GLOBAL_CONTEXT_SEED = "context";
export const NAMESPACE_SEED = "namespace";
export const ENTRY_SEED = "entry";
export const REVERSE_ENTRY_SEED = "reverse-entry";
export const CLAIM_REQUEST_SEED = "rent-request";

export const namespacesProgram = (
  connection: Connection,
  wallet?: Wallet,
  confirmOptions?: ConfirmOptions
) => {
  return new Program<NAMESPACES_PROGRAM>(
    NAMESPACES_IDL,
    NAMESPACES_PROGRAM_ID,
    new AnchorProvider(
      connection,
      wallet ?? emptyWallet(Keypair.generate().publicKey),
      confirmOptions ?? {}
    )
  );
};
