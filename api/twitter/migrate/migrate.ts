import { withRevokeCertificateV2 } from "@cardinal/certificates";
import { emptyWallet, tryPublicKey } from "@cardinal/common";
import {
  findNamespaceId,
  getGlobalReverseNameEntry,
  getNameEntry,
  withApproveClaimRequest,
  withInvalidateExpiredNameEntry,
  withInvalidateExpiredReverseEntry,
  withMigrateNameEntryMint,
  withSetGlobalReverseEntry,
  withSetNamespaceReverseEntry,
} from "@cardinal/namespaces";
import { tryGetAccount } from "@cardinal/token-manager";
import { MasterEdition } from "@metaplex-foundation/mpl-token-metadata";
import * as anchor from "@project-serum/anchor";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";

import { connectionFor } from "../../common/connection";

const NAMESPACE_NAME = "twitter";

export async function migrate(
  publicKey: string,
  entryName: string,
  cluster = "mainnet"
): Promise<{
  status: number;
  mintId?: string;
  transactions?: string[];
  message?: string;
}> {
  const connection = connectionFor(cluster);
  const userAddress = tryPublicKey(publicKey);
  if (!userAddress) {
    return {
      status: 400,
      message: "Invalid user public address",
    };
  }
  const userWallet = emptyWallet(userAddress);
  let approverAuthority: Keypair | undefined;
  try {
    approverAuthority = Keypair.fromSecretKey(
      anchor.utils.bytes.bs58.decode(process.env.TWITTER_SOLANA_KEY || "")
    );
  } catch {
    throw new Error(
      `${NAMESPACE_NAME} pk incorrect or not found ${
        process.env.DISCORD_SOLANA_KEY || ""
      }`
    );
  }

  const nameEntry = await tryGetAccount(() =>
    getNameEntry(connection, NAMESPACE_NAME, entryName)
  );

  if (!nameEntry) {
    return {
      status: 400,
      message: `No name entry for handle ${entryName} exists`,
    };
  }

  const masterEditionId = await MasterEdition.getPDA(nameEntry.parsed.mint);
  try {
    await MasterEdition.getInfo(connection, masterEditionId);
    return {
      status: 400,
      message: "Name entry either already migrated or already token manager",
    };
  } catch (e) {
    ("pass");
  }

  const revokeTransaction = new Transaction();
  /// Start Approve
  await withApproveClaimRequest(revokeTransaction, connection, userWallet, {
    namespaceName: NAMESPACE_NAME,
    entryName: entryName,
    user: userWallet.publicKey,
    approveAuthority: approverAuthority.publicKey,
  });
  /// End Approve

  const isNameEntryClaimed = nameEntry.parsed.isClaimed;
  if (isNameEntryClaimed) {
    /// Start Unlink
    const [namespaceId] = await findNamespaceId(NAMESPACE_NAME);
    await withRevokeCertificateV2(connection, userWallet, revokeTransaction, {
      certificateMint: nameEntry.parsed.mint,
      revokeRecipient: namespaceId,
    });

    const globalReverseEntry = await tryGetAccount(() =>
      getGlobalReverseNameEntry(connection, userWallet.publicKey)
    );
    if (globalReverseEntry) {
      await withInvalidateExpiredReverseEntry(
        revokeTransaction,
        connection,
        userWallet,
        {
          namespaceName: NAMESPACE_NAME,
          mintId: nameEntry.parsed.mint,
          entryName: nameEntry.parsed.name,
          reverseEntryId: globalReverseEntry.pubkey,
        }
      );
    }

    await withInvalidateExpiredNameEntry(
      revokeTransaction,
      connection,
      userWallet,
      {
        namespaceName: NAMESPACE_NAME,
        mintId: nameEntry.parsed.mint,
        entryName: nameEntry.parsed.name,
      }
    );
    /// End Unlink
  }

  /// Start Migrate
  const migrateTransaction = new Transaction();
  migrateTransaction.add(
    new TransactionInstruction({
      keys: [],
      programId: new PublicKey("ComputeBudget111111111111111111111111111111"),
      data: Buffer.from(
        Uint8Array.of(
          0,
          ...new BN(400000).toArray("le", 4),
          ...new BN(0).toArray("le", 4)
        )
      ),
    })
  );

  const mintKeypair = Keypair.generate();
  await withMigrateNameEntryMint(migrateTransaction, connection, userWallet, {
    namespaceName: NAMESPACE_NAME,
    entryName: entryName,
    certificateMint: nameEntry.parsed.mint,
    mintKeypair: mintKeypair,
  });

  // set namespace reverse entry
  await withSetNamespaceReverseEntry(
    migrateTransaction,
    connection,
    userWallet,
    NAMESPACE_NAME,
    entryName,
    mintKeypair.publicKey,
    userWallet.publicKey
  );

  const checkGlobalNameEntry = await tryGetAccount(() =>
    getGlobalReverseNameEntry(connection, userWallet.publicKey)
  );

  if (
    !checkGlobalNameEntry ||
    (checkGlobalNameEntry &&
      checkGlobalNameEntry.parsed.namespaceName === NAMESPACE_NAME)
  ) {
    await withSetGlobalReverseEntry(
      migrateTransaction,
      connection,
      userWallet,
      {
        namespaceName: NAMESPACE_NAME,
        entryName: entryName,
        mintId: mintKeypair.publicKey,
      }
    );
  }
  /// End Migrate

  revokeTransaction.feePayer = userWallet.publicKey;
  revokeTransaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;
  revokeTransaction.partialSign(approverAuthority);

  // Serialize and return the unsigned transaction.
  const revokeSerialized = revokeTransaction.serialize({
    verifySignatures: false,
    requireAllSignatures: false,
  });
  const revokeBase64 = revokeSerialized.toString("base64");

  migrateTransaction.feePayer = userWallet.publicKey;
  migrateTransaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;
  migrateTransaction.partialSign(mintKeypair);

  // Serialize and return the unsigned transaction.
  const migrateSerialized = migrateTransaction.serialize({
    verifySignatures: false,
    requireAllSignatures: false,
  });
  const migrateBase64 = migrateSerialized.toString("base64");

  return {
    status: 200,
    mintId: mintKeypair.publicKey.toString(),
    transactions: [revokeBase64, migrateBase64],
    message: `Returned succesfull transaction for ${publicKey} to migrate handle (${entryName})`,
  };
}
