import { emptyWallet, tryGetAccount } from "@cardinal/common";
import {
  findClaimRequestId,
  findNamespaceId,
  getGlobalReverseNameEntry,
  tryGetNameEntry,
  withApproveClaimRequest,
  withSetGlobalReverseEntry,
  withSetNamespaceReverseEntry,
} from "@cardinal/namespaces";
import type { Connection } from "@solana/web3.js";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";

import {
  shouldMigrate,
  shouldRevoke,
  withClaim,
  withInitAndClaim,
  withMigrateAndClaim,
  withRevoke,
} from "./claimUtils";

export async function claimTransaction(
  connection: Connection,
  namespaceName: string,
  publicKey: string,
  entryName: string,
  approverAuthority: Keypair
): Promise<string[]> {
  const userWallet = emptyWallet(new PublicKey(publicKey));
  const [namespaceId] = await findNamespaceId(namespaceName);
  const [claimRequestId] = await findClaimRequestId(
    namespaceId,
    entryName,
    userWallet.publicKey
  );
  const checkNameEntry = await tryGetNameEntry(
    connection,
    namespaceName,
    entryName
  );

  const approveTransaction = new Transaction();
  const revokeTransaction = new Transaction();
  const migrateAndClaimTransaction = new Transaction();
  const claimTransaction = new Transaction();
  let mintKeypair: Keypair | undefined;

  console.log("Approve claim request");
  await withApproveClaimRequest(approveTransaction, connection, userWallet, {
    namespaceName: namespaceName,
    entryName: entryName,
    user: userWallet.publicKey,
    approveAuthority: approverAuthority.publicKey,
  });

  const shouldMigrateBool =
    checkNameEntry && namespaceName === "twitter"
      ? await shouldMigrate(connection, checkNameEntry.parsed.mint)
      : false;

  if (!checkNameEntry) {
    ////////////////////// Init and claim //////////////////////
    mintKeypair = Keypair.generate();
    await withInitAndClaim(
      connection,
      userWallet,
      claimTransaction,
      namespaceName,
      entryName,
      mintKeypair
    );
  } else if (checkNameEntry && !checkNameEntry.parsed.isClaimed) {
    ////////////////////// Claim already initialized //////////////////////
    if (shouldMigrateBool) {
      mintKeypair = Keypair.generate();
      await withMigrateAndClaim(
        connection,
        userWallet,
        migrateAndClaimTransaction,
        namespaceName,
        entryName,
        checkNameEntry.parsed.mint,
        mintKeypair
      );
    } else {
      await withClaim(
        connection,
        userWallet,
        claimTransaction,
        namespaceName,
        entryName,
        checkNameEntry.parsed.mint
      );
    }
  } else {
    ////////////////////// Potentially revoke and claim //////////////////////
    const shouldRevokeBool = await shouldRevoke(
      connection,
      checkNameEntry.parsed.mint,
      namespaceId
    );
    if (shouldRevokeBool) {
      await withRevoke(
        connection,
        userWallet,
        revokeTransaction,
        namespaceName,
        entryName,
        checkNameEntry.parsed.mint,
        claimRequestId,
        checkNameEntry.parsed.reverseEntry || undefined,
        shouldMigrateBool
      );
    }
    if (shouldMigrateBool) {
      mintKeypair = Keypair.generate();
      await withMigrateAndClaim(
        connection,
        userWallet,
        migrateAndClaimTransaction,
        namespaceName,
        entryName,
        checkNameEntry.parsed.mint,
        mintKeypair
      );
    } else {
      await withClaim(
        connection,
        userWallet,
        claimTransaction,
        namespaceName,
        entryName,
        checkNameEntry.parsed.mint
      );
    }
  }

  // set namespace reverse entry
  await withSetNamespaceReverseEntry(
    migrateAndClaimTransaction.instructions.length > 0
      ? migrateAndClaimTransaction
      : claimTransaction,
    connection,
    userWallet,
    namespaceName,
    entryName,
    mintKeypair?.publicKey ?? checkNameEntry!.parsed.mint,
    userWallet.publicKey
  );

  const checkGlobalNameEntry = await tryGetAccount(() =>
    getGlobalReverseNameEntry(connection, userWallet.publicKey)
  );

  if (
    !checkGlobalNameEntry ||
    (checkGlobalNameEntry &&
      checkGlobalNameEntry.parsed.namespaceName === namespaceName)
  ) {
    await withSetGlobalReverseEntry(
      migrateAndClaimTransaction.instructions.length > 0
        ? migrateAndClaimTransaction
        : claimTransaction,
      connection,
      userWallet,
      {
        namespaceName: namespaceName,
        entryName: entryName,
        mintId: mintKeypair?.publicKey ?? checkNameEntry!.parsed.mint,
      }
    );
  }

  const transactions = [
    revokeTransaction,
    migrateAndClaimTransaction,
    claimTransaction,
  ].filter((tx) => tx.instructions.length > 0);
  const recentBlockhash = await connection.getRecentBlockhash("max");
  const base64SerializedTransactions = transactions.map((tx, i) => {
    tx.feePayer = userWallet.publicKey;
    tx.recentBlockhash = recentBlockhash.blockhash;

    // add approve to first transaction
    if (i === 0) {
      tx.instructions = [
        ...approveTransaction.instructions,
        ...tx.instructions,
      ];
      tx.partialSign(approverAuthority);
    }
    // sign claim transaction
    if (i === transactions.length - 1) {
      mintKeypair && tx.partialSign(mintKeypair);
    }

    // serialized to maintain order
    const copiedTx = Transaction.from(
      tx.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
      })
    );

    return copiedTx
      .serialize({
        verifySignatures: false,
        requireAllSignatures: false,
      })
      .toString("base64");
  });

  return base64SerializedTransactions;
}
