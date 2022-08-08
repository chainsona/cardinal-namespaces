import { withRevokeCertificateV2 } from "@cardinal/certificates";
import { emptyWallet, tryPublicKey } from "@cardinal/common";
import type { NAMESPACES_PROGRAM } from "@cardinal/namespaces";
import {
  findClaimRequestId,
  findNameEntryId,
  findNamespaceId,
  getGlobalReverseNameEntry,
  getNameEntry,
  getNamespace,
  getReverseNameEntryForNamespace,
  NAMESPACES_IDL,
  NAMESPACES_PROGRAM_ID,
  withApproveClaimRequest,
  withInvalidateExpiredNameEntry,
  withInvalidateExpiredReverseEntry,
  withRemainingAccountsForClaim,
} from "@cardinal/namespaces";
import { findAta, tryGetAccount } from "@cardinal/token-manager";
import {
  getRemainingAccountsForKind,
  TOKEN_MANAGER_ADDRESS,
  TokenManagerKind,
} from "@cardinal/token-manager/dist/cjs/programs/tokenManager";
import {
  findMintCounterId,
  findTokenManagerAddress,
} from "@cardinal/token-manager/dist/cjs/programs/tokenManager/pda";
import {
  MasterEdition,
  Metadata,
} from "@metaplex-foundation/mpl-token-metadata";
import * as mplTokenMetadata from "@metaplex-foundation/mpl-token-metadata";
import * as anchor from "@project-serum/anchor";
import { ASSOCIATED_PROGRAM_ID } from "@project-serum/anchor/dist/cjs/utils/token";
import type { Wallet } from "@saberhq/solana-contrib";
import * as splToken from "@solana/spl-token";
import type { Connection } from "@solana/web3.js";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
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
): Promise<{ status: number; transactions?: string[]; message?: string }> {
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

  const userCertificateTokenAccountId = await findAta(
    nameEntry.parsed.mint,
    userWallet.publicKey,
    true
  );
  const certificateMint = new splToken.Token(
    connection,
    nameEntry.parsed.mint,
    splToken.TOKEN_PROGRAM_ID,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    null
  );
  try {
    const userCertificateTokenAccount = await certificateMint.getAccountInfo(
      userCertificateTokenAccountId
    );
    if (
      userCertificateTokenAccount.amount.toNumber() !== 1 ||
      userCertificateTokenAccount.owner.toString() !==
        userWallet.publicKey.toString() ||
      userCertificateTokenAccount.mint.toString() !==
        nameEntry.parsed.mint.toString()
    ) {
      return {
        status: 400,
        message: "User does not currently own name entry",
      };
    }
  } catch (e) {
    return {
      status: 400,
      message: "User has no token account for certificate mint",
    };
  }

  /// Start Approve
  const revokeTransaction = new Transaction();
  await withApproveClaimRequest(revokeTransaction, connection, userWallet, {
    namespaceName: namespaceName,
    entryName: entryName,
    user: userWallet.publicKey,
  });
  /// End Approve

  /// Start Unlink
  const [namespaceId] = await findNamespaceId(namespaceName);
  await withRevokeCertificateV2(connection, userWallet, revokeTransaction, {
    certificateMint: nameEntry.parsed.mint,
    revokeRecipient: namespaceId,
  });

  const namespaceReverseEntry = await tryGetAccount(() =>
    getReverseNameEntryForNamespace(
      connection,
      userWallet.publicKey,
      namespaceId
    )
  );
  const globalReverseEntry = await tryGetAccount(() =>
    getGlobalReverseNameEntry(connection, userWallet.publicKey)
  );
  if (namespaceReverseEntry) {
    await withInvalidateExpiredReverseEntry(
      revokeTransaction,
      connection,
      userWallet,
      {
        namespaceName: namespaceName,
        mintId: nameEntry.parsed.mint,
        entryName: nameEntry.parsed.name,
        reverseEntryId: namespaceReverseEntry.pubkey,
      }
    );
  }
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
  revokeTransaction.partialSign(approverAuthority);
  const revokeTx = Transaction.from(
    revokeTransaction.serialize({
      verifySignatures: false,
      requireAllSignatures: false,
    })
  );

  // Serialize and return the unsigned transaction.
  const revokeSerialized = revokeTx.serialize({
    verifySignatures: false,
    requireAllSignatures: false,
  });
  const revokeBase64 = revokeSerialized.toString("base64");

  migrateTransaction.feePayer = userWallet.publicKey;
  migrateTransaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;
  migrateTransaction.partialSign(mintKeypair);
  const migrateTx = Transaction.from(
    revokeTransaction.serialize({
      verifySignatures: false,
      requireAllSignatures: false,
    })
  );

  // Serialize and return the unsigned transaction.
  const migrateSerialized = migrateTx.serialize({
    verifySignatures: false,
    requireAllSignatures: false,
  });
  const migrateBase64 = migrateSerialized.toString("base64");

  return {
    status: 200,
    transactions: [revokeBase64, migrateBase64],
    message: `Returned succesfull transaction for ${publicKey} to migrate handle (${entryName})`,
  };
}

export async function withMigrateNameEntryMint(
  transaction: Transaction,
  connection: Connection,
  wallet: Wallet,
  params: {
    namespaceName: string;
    entryName: string;
    certificateMint: PublicKey;
    mintKeypair: Keypair;
    duration?: number;
    requestor?: PublicKey;
    payer?: PublicKey;
  }
): Promise<Transaction> {
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  const namespacesProgram = new anchor.Program<NAMESPACES_PROGRAM>(
    NAMESPACES_IDL,
    NAMESPACES_PROGRAM_ID,
    provider
  );
  const [namespaceId] = await findNamespaceId(params.namespaceName);
  const [nameEntryId] = await findNameEntryId(namespaceId, params.entryName);
  const [tokenManagerId] = await findTokenManagerAddress(
    params.mintKeypair.publicKey
  );
  const namespace = await getNamespace(connection, namespaceId);

  const [claimRequestId] = await findClaimRequestId(
    namespaceId,
    params.entryName,
    params.requestor || provider.wallet.publicKey
  );

  const namespaceTokenAccountId =
    await splToken.Token.getAssociatedTokenAddress(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      params.mintKeypair.publicKey,
      namespaceId,
      true
    );

  const tokenManagerTokenAccountId =
    await splToken.Token.getAssociatedTokenAddress(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      params.mintKeypair.publicKey,
      tokenManagerId,
      true
    );

  const recipientTokenAccount = await splToken.Token.getAssociatedTokenAddress(
    splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
    splToken.TOKEN_PROGRAM_ID,
    params.mintKeypair.publicKey,
    params.payer || provider.wallet.publicKey,
    true
  );

  const namespaceCertificateTokenAccountId =
    await splToken.Token.getAssociatedTokenAddress(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      params.certificateMint,
      namespaceId,
      true
    );

  const [mintCounterId] = await findMintCounterId(params.mintKeypair.publicKey);

  const remainingAccountsForClaim = await withRemainingAccountsForClaim(
    connection,
    transaction,
    wallet,
    namespaceId,
    params.mintKeypair.publicKey,
    tokenManagerId,
    params.duration && params.duration > 0 ? params.duration : undefined
  );

  const remainingAccountsForKind = await getRemainingAccountsForKind(
    params.mintKeypair.publicKey,
    namespace.parsed.transferableEntries
      ? TokenManagerKind.Unmanaged
      : TokenManagerKind.Edition
  );

  const mintMetadataId = await Metadata.getPDA(params.mintKeypair.publicKey);
  const mintMasterEditionId = await MasterEdition.getPDA(
    params.mintKeypair.publicKey
  );

  transaction.add(
    namespacesProgram.instruction.migrateNameEntryMint(
      {
        duration:
          params.duration && params.duration > 0
            ? new BN(params.duration)
            : null,
      },
      {
        accounts: {
          namespace: namespaceId,
          nameEntry: nameEntryId,
          namespaceTokenAccount: namespaceTokenAccountId,
          payer: provider.wallet.publicKey,
          namespaceCertificateTokenAccount: namespaceCertificateTokenAccountId,
          mint: params.mintKeypair.publicKey,
          mintMetadata: mintMetadataId,
          masterEdition: mintMasterEditionId,
          mintCounter: mintCounterId,
          tokenManager: tokenManagerId,
          tokenManagerTokenAccount: tokenManagerTokenAccountId,
          recipientTokenAccount: recipientTokenAccount,
          claimRequest: claimRequestId,
          tokenMetadataProgram: mplTokenMetadata.MetadataProgram.PUBKEY,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          associatedToken: ASSOCIATED_PROGRAM_ID,
          tokenManagerProgram: TOKEN_MANAGER_ADDRESS,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
        },
        remainingAccounts: [
          ...remainingAccountsForClaim,
          ...remainingAccountsForKind,
        ],
      }
    )
  );
  return transaction;
}
