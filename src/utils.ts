import { findPaymentManagerAddress } from "@cardinal/token-manager/dist/cjs/programs/paymentManager/pda";
import { TIME_INVALIDATOR_ADDRESS } from "@cardinal/token-manager/dist/cjs/programs/timeInvalidator";
import { findTimeInvalidatorAddress } from "@cardinal/token-manager/dist/cjs/programs/timeInvalidator/pda";
import type { AccountMeta, Connection, PublicKey } from "@solana/web3.js";

import { getNamespace, getReverseEntry } from "./accounts";
import { DEFAULT_PAYMENT_MANAGER, IDENTITIES } from "./constants";

export function formatName(namespace: string, name: string): string {
  return IDENTITIES.includes(namespace) ? `@${name}` : `${name}.${namespace}`;
}

export function breakName(fullName: string): [string, string] {
  if (fullName.startsWith("@")) {
    return ["twitter", fullName.split("@")[1]!];
  }
  const [entryName, namespace] = fullName.split(".");
  return [namespace!, entryName!];
}

export function breakIdentity(fullName: string): [string, string] {
  if (fullName.startsWith("@")) {
    const namespace = fullName.split(":")[1] || "twitter";
    const entryName = fullName.includes(":")
      ? fullName.split("@")[1]!.split(":")[0]!
      : fullName.split("@")[1]!;
    return [namespace, entryName];
  }
  const [entryName, namespace] = fullName.split(".");
  return [namespace!, entryName!];
}

/**
 * shorten the checksummed version of the input address to have 4 characters at start and end
 * @param address
 * @param chars
 * @returns
 */
export function shortenAddress(address: string, chars = 5): string {
  return `${address.substring(0, chars)}...${address.substring(
    address.length - chars
  )}`;
}

export function displayAddress(address: string, shorten = true): string {
  return shorten ? shortenAddress(address) : address;
}

export async function tryGetName(
  connection: Connection,
  pubkey: PublicKey,
  namespace?: PublicKey,
  disallowGlobal?: boolean
): Promise<string[] | undefined> {
  try {
    const reverseEntry = await getReverseEntry(
      connection,
      pubkey,
      namespace,
      disallowGlobal
    );
    return [
      formatName(
        reverseEntry.parsed.namespaceName,
        reverseEntry.parsed.entryName
      ),
      reverseEntry.parsed.namespaceName,
    ];
  } catch (e) {
    console.log(e);
  }
  return undefined;
}

export async function nameForDisplay(
  connection: Connection,
  pubkey: PublicKey,
  namespace: PublicKey
): Promise<string> {
  const name = await tryGetName(connection, pubkey, namespace);
  return (name && name[0]) || displayAddress(pubkey.toString());
}

export const withRemainingAccountsForClaim = async (
  connection: Connection,
  namespaceId: PublicKey,
  tokenManagerId: PublicKey
): Promise<AccountMeta[]> => {
  const namespace = await getNamespace(connection, namespaceId);
  if (
    namespace.parsed.paymentAmountDaily.toNumber() > 0 ||
    namespace.parsed.maxExpiration
  ) {
    const [paymentManagerId] = await findPaymentManagerAddress(
      DEFAULT_PAYMENT_MANAGER
    );
    const [timeInvalidatorId] = await findTimeInvalidatorAddress(
      tokenManagerId
    );
    const accounts = [
      {
        pubkey: namespace.parsed.paymentMint,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: paymentManagerId,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: timeInvalidatorId,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: TIME_INVALIDATOR_ADDRESS,
        isSigner: false,
        isWritable: false,
      },
    ];
    return accounts;
  } else {
    return [];
  }
};
