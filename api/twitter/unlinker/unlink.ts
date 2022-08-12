/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { withRevokeCertificateV2 } from "@cardinal/certificates";
import { emptyWallet, tryGetAccount } from "@cardinal/common";
import {
  findNamespaceId,
  getGlobalReverseNameEntry,
  getReverseNameEntryForNamespace,
  tryGetNameEntry,
  withInvalidateExpiredNameEntry,
  withInvalidateExpiredReverseEntry,
} from "@cardinal/namespaces";
import { withInvalidate } from "@cardinal/token-manager";
import { PublicKey, Transaction } from "@solana/web3.js";

import { shouldMigrate } from "../../common/claimUtils";
import { connectionFor } from "../../common/connection";

const NAMESPACE_NAME = "twitter";

export async function unlink(
  publicKey: string,
  entryName: string,
  cluster = "mainnet"
): Promise<{
  status: number;
  transactions?: string[];
  message?: string;
}> {
  const connection = connectionFor(cluster);
  const userWallet = emptyWallet(new PublicKey(publicKey));
  const transaction = new Transaction();
  const checkNameEntry = await tryGetNameEntry(
    connection,
    NAMESPACE_NAME,
    entryName
  );

  if (!checkNameEntry) {
    return {
      status: 404,
      message: `Name entry not found`,
    };
  }

  const [namespaceReverseEntry, globalReverseEntry] = await Promise.all([
    tryGetAccount(() =>
      getReverseNameEntryForNamespace(
        connection,
        userWallet.publicKey,
        namespaceId
      )
    ),
    tryGetAccount(() =>
      getGlobalReverseNameEntry(connection, userWallet.publicKey)
    ),
  ]);

  const isCertificate = await shouldMigrate(
    connection,
    checkNameEntry.parsed.mint
  );

  const [namespaceId] = await findNamespaceId(NAMESPACE_NAME);

  if (isCertificate) {
    await withRevokeCertificateV2(connection, userWallet, transaction, {
      certificateMint: checkNameEntry.parsed.mint,
      revokeRecipient: namespaceId,
    });
  } else {
    // invalidate token manager
    await withInvalidate(
      transaction,
      connection,
      userWallet,
      checkNameEntry.parsed.mint
    );
  }
  if (
    namespaceReverseEntry &&
    namespaceReverseEntry.parsed.entryName === entryName
  ) {
    await withInvalidateExpiredReverseEntry(
      transaction,
      connection,
      userWallet,
      {
        namespaceName: NAMESPACE_NAME,
        mintId: checkNameEntry.parsed.mint,
        entryName: entryName,
        reverseEntryId: namespaceReverseEntry.pubkey,
      }
    );
  }
  if (globalReverseEntry && globalReverseEntry.parsed.entryName === entryName) {
    await withInvalidateExpiredReverseEntry(
      transaction,
      connection,
      userWallet,
      {
        namespaceName: NAMESPACE_NAME,
        mintId: checkNameEntry.parsed.mint,
        entryName: entryName,
        reverseEntryId: globalReverseEntry.pubkey,
      }
    );
  }
  await withInvalidateExpiredNameEntry(transaction, connection, userWallet, {
    namespaceName: NAMESPACE_NAME,
    mintId: checkNameEntry.parsed.mint,
    entryName,
  });

  transaction.feePayer = userWallet.publicKey;
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;

  // serialized to maintain order
  const copiedTx = Transaction.from(
    transaction.serialize({
      verifySignatures: false,
      requireAllSignatures: false,
    })
  );
  const tx = copiedTx
    .serialize({
      verifySignatures: false,
      requireAllSignatures: false,
    })
    .toString("base64");

  return {
    status: 200,
    transactions: [tx],
    message: `Returned succesfull transaction for ${publicKey} to claim handle (${entryName})`,
  };
}
