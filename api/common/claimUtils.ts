import { emptyWallet, getOwner } from "@cardinal/common";
import {
  deprecated,
  tryGetAta,
  withClaimNameEntry,
  withInitNameEntry,
  withInitNameEntryMint,
  withMigrateNameEntryMint,
  withRevokeNameEntry,
  withRevokeReverseEntry,
} from "@cardinal/namespaces";
import { MasterEdition } from "@metaplex-foundation/mpl-token-metadata";
import type { Wallet } from "@saberhq/solana-contrib";
import type {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { ComputeBudgetProgram } from "@solana/web3.js";

export async function withInitAndClaim(
  connection: Connection,
  wallet: Wallet,
  transaction: Transaction,
  namespaceName: string,
  entryName: string,
  mintKeypair: Keypair,
  duration?: number,
  requestor = wallet.publicKey,
  payer = wallet.publicKey
): Promise<Transaction> {
  console.log("---> withInitAndClaim");
  await withInitNameEntry(
    transaction,
    connection,
    payer ? emptyWallet(payer) : wallet,
    namespaceName,
    entryName
  );
  await withInitNameEntryMint(
    transaction,
    connection,
    payer ? emptyWallet(payer) : wallet,
    namespaceName,
    entryName,
    mintKeypair
  );
  await withClaimNameEntry(
    transaction,
    connection,
    wallet,
    namespaceName,
    entryName,
    mintKeypair.publicKey,
    duration,
    requestor,
    payer
  );

  return transaction;
}

export async function withClaim(
  connection: Connection,
  wallet: Wallet,
  transaction: Transaction,
  namespaceName: string,
  entryName: string,
  mint: PublicKey
): Promise<Transaction> {
  console.log("---> withClaim");
  await withClaimNameEntry(
    transaction,
    connection,
    wallet,
    namespaceName,
    entryName,
    mint,
    0
  );

  return transaction;
}

export async function withRevoke(
  connection: Connection,
  wallet: Wallet,
  transaction: Transaction,
  namespaceName: string,
  entryName: string,
  mint: PublicKey,
  claimRequestId: PublicKey,
  reverseEntryId?: PublicKey,
  shouldMigrate = false
): Promise<Transaction> {
  console.log("---> withRevoke");
  const reverseEntry =
    reverseEntryId && (await connection.getAccountInfo(reverseEntryId));
  if (reverseEntry) {
    await withRevokeReverseEntry(
      transaction,
      connection,
      wallet,
      namespaceName,
      entryName,
      reverseEntryId,
      claimRequestId
    );
  }

  const owner = await getOwner(connection, mint.toString());
  if (!owner) {
    throw Error("No owner found for name entry");
  }

  if (shouldMigrate) {
    await deprecated.withRevokeEntry(
      connection,
      wallet,
      namespaceName,
      entryName,
      mint,
      owner,
      claimRequestId,
      transaction
    );
  } else {
    await withRevokeNameEntry(
      transaction,
      connection,
      wallet,
      namespaceName,
      entryName,
      owner,
      mint,
      claimRequestId
    );
  }
  return transaction;
}

export async function withMigrateAndClaim(
  connection: Connection,
  wallet: Wallet,
  transaction: Transaction,
  namespaceName: string,
  entryName: string,
  mint: PublicKey,
  mintKeypair: Keypair
): Promise<Transaction> {
  console.log("---> withMigrateAndClaim");
  transaction.add(
    ComputeBudgetProgram.requestUnits({
      units: 400000,
      additionalFee: 0,
    })
  );

  await withMigrateNameEntryMint(transaction, connection, wallet, {
    namespaceName: namespaceName,
    entryName: entryName,
    certificateMint: mint,
    mintKeypair: mintKeypair,
  });

  return transaction;
}

export async function shouldMigrate(
  connection: Connection,
  mint: PublicKey
): Promise<boolean> {
  let isMasterEdition = true;
  const masterEditionId = await MasterEdition.getPDA(mint);
  try {
    await MasterEdition.getInfo(connection, masterEditionId);
  } catch (e) {
    isMasterEdition = false;
  }
  return !isMasterEdition;
}

export async function shouldRevoke(
  connection: Connection,
  mint: PublicKey,
  namespaceId: PublicKey
): Promise<boolean> {
  const namespaceTokenAccount = await tryGetAta(connection, mint, namespaceId);
  return !(
    namespaceTokenAccount?.amount &&
    namespaceTokenAccount?.amount.toNumber() > 0
  );
}
