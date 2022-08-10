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

import { connectionFor } from "../common/connection";

export async function migrate(
  namespaceName: string,
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
      anchor.utils.bytes.bs58.decode(
        namespaceName === "twitter"
          ? process.env.TWITTER_SOLANA_KEY || ""
          : namespaceName === "discord"
          ? process.env.DISCORD_SOLANA_KEY || ""
          : ""
      )
    );
  } catch {
    throw new Error(
      `${namespaceName} pk incorrect or not found ${
        process.env.DISCORD_SOLANA_KEY || ""
      }`
    );
  }

  const nameEntry = await tryGetAccount(() =>
    getNameEntry(connection, namespaceName, entryName)
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

  // const userCertificateTokenAccountId = await findAta(
  //   nameEntry.parsed.mint,
  //   userWallet.publicKey,
  //   true
  // );
  // const certificateMint = new splToken.Token(
  //   connection,
  //   nameEntry.parsed.mint,
  //   splToken.TOKEN_PROGRAM_ID,
  //   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //   // @ts-ignore
  //   null
  // );
  // try {
  //   const userCertificateTokenAccount = await certificateMint.getAccountInfo(
  //     userCertificateTokenAccountId
  //   );
  //   if (
  //     userCertificateTokenAccount.amount.toNumber() !== 1 ||
  //     userCertificateTokenAccount.owner.toString() !==
  //       userWallet.publicKey.toString() ||
  //     userCertificateTokenAccount.mint.toString() !==
  //       nameEntry.parsed.mint.toString()
  //   ) {
  //     return {
  //       status: 400,
  //       message: "User does not currently own name entry",
  //     };
  //   }
  // } catch (e) {
  //   return {
  //     status: 400,
  //     message: "User has no token account for certificate mint",
  //   };
  // }

  const revokeTransaction = new Transaction();
  /// Start Approve
  await withApproveClaimRequest(revokeTransaction, connection, userWallet, {
    namespaceName: namespaceName,
    entryName: entryName,
    user: userWallet.publicKey,
    approveAuthority: approverAuthority.publicKey,
  });
  /// End Approve

  const isNameEntryClaimed = nameEntry.parsed.isClaimed;
  if (isNameEntryClaimed) {
    /// Start Unlink
    const [namespaceId] = await findNamespaceId(namespaceName);
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
          namespaceName: namespaceName,
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
        namespaceName: namespaceName,
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
    namespaceName: namespaceName,
    entryName: entryName,
    certificateMint: nameEntry.parsed.mint,
    mintKeypair: mintKeypair,
  });
  /// End Migrate

  revokeTransaction.feePayer = userWallet.publicKey;
  revokeTransaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;
  isNameEntryClaimed && revokeTransaction.partialSign(mintKeypair);

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
