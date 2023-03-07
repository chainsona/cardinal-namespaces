import { utils } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

import {
  CLAIM_REQUEST_SEED,
  ENTRY_SEED,
  GLOBAL_CONTEXT_SEED,
  NAMESPACE_SEED,
  NAMESPACES_PROGRAM_ID,
  REVERSE_ENTRY_SEED,
} from "./constants";

/**
 * Finds the namespace id.
 * @returns
 */
export const findNamespaceId = (namespaceName: string): PublicKey =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode(NAMESPACE_SEED),
      utils.bytes.utf8.encode(namespaceName),
    ],
    NAMESPACES_PROGRAM_ID
  )[0];

/**
 * Finds the entry id in a given namespace.
 * @returns
 */
export const findNameEntryId = (
  namespaceId: PublicKey,
  entryName: string
): PublicKey =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode(ENTRY_SEED),
      namespaceId.toBytes(),
      utils.bytes.utf8.encode(entryName),
    ],
    NAMESPACES_PROGRAM_ID
  )[0];

/**
 * Finds the claim request ID for a given namespace and name.
 * @returns
 */
export const findClaimRequestId = (
  namespaceId: PublicKey,
  entryName: string,
  requestor: PublicKey
): PublicKey =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode(CLAIM_REQUEST_SEED),
      namespaceId.toBytes(),
      utils.bytes.utf8.encode(entryName),
      requestor.toBytes(),
    ],
    NAMESPACES_PROGRAM_ID
  )[0];

/**
 * @Deprecated
 * Finds the deprecated reverse entry ID for a given publickey.
 * @returns
 */
export const findDeprecatedReverseEntryId = (pubkey: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode(REVERSE_ENTRY_SEED), pubkey.toBytes()],
    NAMESPACES_PROGRAM_ID
  )[0];

/**
 * @Deprecated moving to only using findReverseNameEntryForNamespaceId and findGlobalReverseNameEntryId
 * but keeping it for backwards compatibility. Essentially same as findReverseNameEntryForNamespaceId
 *
 * Finds the reverse entry ID for a given publickey.
 * @returns
 */
export const findReverseEntryId = (
  namespace: PublicKey,
  pubkey: PublicKey
): PublicKey =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode(REVERSE_ENTRY_SEED),
      namespace.toBuffer(),
      pubkey.toBytes(),
    ],
    NAMESPACES_PROGRAM_ID
  )[0];

/**
 * Finds the reverse entry ID for a given publickey.
 * @returns
 */
export const findReverseNameEntryForNamespaceId = (
  namespace: PublicKey,
  pubkey: PublicKey
): PublicKey =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode(REVERSE_ENTRY_SEED),
      namespace.toBuffer(),
      pubkey.toBytes(),
    ],
    NAMESPACES_PROGRAM_ID
  )[0];

/**
 * Finds the global reverse entry ID for a given publickey.
 * @returns
 */
export const findGlobalReverseNameEntryId = (pubkey: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode(REVERSE_ENTRY_SEED), pubkey.toBytes()],
    NAMESPACES_PROGRAM_ID
  )[0];

/**
 * Finds the namespace id.
 * @returns
 */
export const findGlobalContextId = (): PublicKey =>
  PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode(GLOBAL_CONTEXT_SEED)],
    NAMESPACES_PROGRAM_ID
  )[0];
