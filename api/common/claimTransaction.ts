import { emptyWallet, getOwner } from "@cardinal/common";
import {
  deprecated,
  findClaimRequestId,
  findNamespaceId,
  tryGetAta,
  tryGetNameEntry,
  withApproveClaimRequest,
  withClaimNameEntry,
  withInitNameEntry,
  withInitNameEntryMint,
  withRevokeNameEntry,
  withRevokeReverseEntry,
  withSetNamespaceReverseEntry,
} from "@cardinal/namespaces";
import { MasterEdition } from "@metaplex-foundation/mpl-token-metadata";
import type { Connection } from "@solana/web3.js";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";

import { secondaryConnectionFor } from "../common/connection";

export async function claimTransaction(
  connection: Connection,
  namespaceName: string,
  publicKey: string,
  entryName: string,
  approverAuthority: Keypair,
  cluster = "mainnet"
): Promise<string> {
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

  let tx = new Transaction();
  let mintKeypair: Keypair | undefined;

  console.log("Approve claim request");
  await withApproveClaimRequest(tx, connection, userWallet, {
    namespaceName: namespaceName,
    entryName: entryName,
    user: userWallet.publicKey,
    approveAuthority: approverAuthority.publicKey,
  });

  if (!checkNameEntry) {
    ////////////////////// Init and claim //////////////////////
    console.log("---> Initializing and claiming entry:", entryName);
    mintKeypair = Keypair.generate();
    await withInitNameEntry(
      tx,
      connection,
      userWallet,
      namespaceName,
      entryName
    );
    await withInitNameEntryMint(
      tx,
      connection,
      userWallet,
      namespaceName,
      entryName,
      mintKeypair
    );
    await withClaimNameEntry(
      tx,
      connection,
      userWallet,
      namespaceName,
      entryName,
      mintKeypair.publicKey,
      0
    );
    // set namespace reverse entry
    await withSetNamespaceReverseEntry(
      tx,
      connection,
      userWallet,
      namespaceName,
      entryName,
      mintKeypair.publicKey,
      userWallet.publicKey
    );
    // set global reverse entry
    // await withSetGlobalReverseEntry(tx, connection, userWallet, {
    //   namespaceName: namespace,
    //   entryName: entryName,
    //   mintId: mintKeypair.publicKey,
    // });
  } else if (checkNameEntry && !checkNameEntry.parsed.isClaimed) {
    ////////////////////// Invalidated claim //////////////////////
    console.log("---> Claiming invalidated entry:", entryName);
    await withClaimNameEntry(
      tx,
      connection,
      userWallet,
      namespaceName,
      entryName,
      checkNameEntry.parsed.mint,
      0
    );
    // set namespace reverse entry
    await withSetNamespaceReverseEntry(
      tx,
      connection,
      userWallet,
      namespaceName,
      entryName,
      checkNameEntry.parsed.mint,
      userWallet.publicKey
    );
  } else {
    const namespaceTokenAccount = await tryGetAta(
      connection,
      checkNameEntry.parsed.mint,
      namespaceId
    );

    if (
      namespaceTokenAccount?.amount &&
      namespaceTokenAccount?.amount.toNumber() > 0
    ) {
      ////////////////////// Expired claim //////////////////////
      console.log("---> Claiming expired entry:", entryName);
      await withClaimNameEntry(
        tx,
        connection,
        userWallet,
        namespaceName,
        entryName,
        checkNameEntry.parsed.mint,
        0
      );
      // set namespace reverse entry
      await withSetNamespaceReverseEntry(
        tx,
        connection,
        userWallet,
        namespaceName,
        entryName,
        checkNameEntry.parsed.mint,
        userWallet.publicKey
      );
      // set global reverse entry
      // await withSetGlobalReverseEntry(tx, connection, userWallet, {
      //   namespaceName: namespace,
      //   entryName: entryName,
      //   mintId: checkNameEntry.parsed.mint,
      // });
    } else {
      ////////////////////// Revoke and claim //////////////////////
      console.log("---> and claiming entry:", entryName);
      if (checkNameEntry.parsed.reverseEntry) {
        await withRevokeReverseEntry(
          tx,
          connection,
          userWallet,
          namespaceName,
          entryName,
          checkNameEntry.parsed.reverseEntry,
          claimRequestId
        );
      }

      const owner = await getOwner(
        secondaryConnectionFor(cluster),
        checkNameEntry.parsed.mint.toString()
      );
      if (!owner) {
        throw Error("No owner found for name entry");
      }
      let isMasterEdition = true;
      const masterEditionId = await MasterEdition.getPDA(
        checkNameEntry.parsed.mint
      );
      try {
        await MasterEdition.getInfo(connection, masterEditionId);
      } catch (e) {
        isMasterEdition = false;
      }
      if (!isMasterEdition) {
        await deprecated.withRevokeEntry(
          connection,
          userWallet,
          namespaceName,
          entryName,
          checkNameEntry.parsed.mint,
          owner,
          claimRequestId,
          tx
        );
      } else {
        await withRevokeNameEntry(
          tx,
          connection,
          userWallet,
          namespaceName,
          entryName,
          owner,
          checkNameEntry.parsed.mint,
          claimRequestId
        );
      }

      await withClaimNameEntry(
        tx,
        connection,
        userWallet,
        namespaceName,
        entryName,
        checkNameEntry.parsed.mint,
        0
      );
      // set namespace reverse entry
      await withSetNamespaceReverseEntry(
        tx,
        connection,
        userWallet,
        namespaceName,
        entryName,
        checkNameEntry.parsed.mint,
        userWallet.publicKey
      );
      // set global reverse entry
      // await withSetGlobalReverseEntry(tx, connection, userWallet, {
      //   namespaceName: namespace,
      //   entryName: entryName,
      //   mintId: checkNameEntry.parsed.mint,
      // });
    }
  }

  tx.feePayer = userWallet.publicKey;
  tx.recentBlockhash = (await connection.getRecentBlockhash("max")).blockhash;
  tx.partialSign(approverAuthority);
  mintKeypair && tx.partialSign(mintKeypair);
  tx = Transaction.from(
    tx.serialize({
      verifySignatures: false,
      requireAllSignatures: false,
    })
  );

  // Serialize and return the unsigned transaction.
  const serialized = tx.serialize({
    verifySignatures: false,
    requireAllSignatures: false,
  });
  return serialized.toString("base64");
}
