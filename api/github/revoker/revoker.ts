/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { getOwner } from "@cardinal/common";
import {
  deprecated,
  findClaimRequestId,
  findNamespaceId,
  shortenAddress,
  withCreateClaimRequest,
  withRevokeNameEntry,
  withRevokeReverseEntry,
  withUpdateClaimRequest,
} from "@cardinal/namespaces";
import { MasterEdition } from "@metaplex-foundation/mpl-token-metadata";
import * as anchor from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
import * as web3 from "@solana/web3.js";
import fetch from "node-fetch";

import { connectionFor, secondaryConnectionFor } from "../../common/connection";
import type { DiscordUserInfoParams } from "../../tools/types";
import { tryGetNameEntry } from "../claimer/utils";
import { tryGetClaimRequest } from "./api";

const NAMESPACE_NAME = "github";

export async function revokeHolder(
  publicKey: string,
  entryName: string,
  accessToken?: string,
  cluster: web3.Cluster = "mainnet-beta"
): Promise<{ status: number; txid?: string; message?: string }> {
  let wallet: web3.Keypair | undefined;
  try {
    wallet = web3.Keypair.fromSecretKey(
      anchor.utils.bytes.bs58.decode(process.env.DISCORD_SOLANA_KEY || "")
    );
  } catch {
    throw new Error(
      `${NAMESPACE_NAME} pk incorrect or not found ${
        process.env.DISCORD_SOLANA_KEY || ""
      }`
    );
  }
  let approved = true;

  // get user information
  const userResponse = await fetch("http://discordapp.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken!}`,
    },
  });
  const userJson = await userResponse.json();
  let parsedUserResponse: DiscordUserInfoParams | undefined;
  try {
    parsedUserResponse = userJson as DiscordUserInfoParams;
  } catch (e) {
    return {
      status: 500,
      message: "Error parsing server response",
    };
  }
  approved = parsedUserResponse.username === entryName;

  if (!approved) {
    return {
      status: 404,
      txid: "",
      message: `Public key ${shortenAddress(publicKey)} not found in tweet`,
    };
  }

  const connection = connectionFor(cluster);
  console.log(`Approving claim request for ${publicKey} for ${entryName}`);

  const [nameEntry, claimRequest] = await Promise.all([
    tryGetNameEntry(connection, NAMESPACE_NAME, entryName),
    tryGetClaimRequest(
      connection,
      NAMESPACE_NAME,
      entryName,
      new web3.PublicKey(publicKey)
    ),
  ]);
  if (!nameEntry) throw new Error(`No entry for ${entryName} to be revoked`);

  const [namespaceId] = await findNamespaceId(NAMESPACE_NAME);
  const [claimRequestId] = await findClaimRequestId(
    namespaceId,
    entryName,
    new web3.PublicKey(publicKey)
  );

  const transaction = new web3.Transaction();
  if (!claimRequest) {
    console.log("Creating claim request");
    await withCreateClaimRequest(
      connection,
      new SignerWallet(wallet),
      NAMESPACE_NAME,
      entryName,
      new web3.PublicKey(publicKey),
      transaction
    );
  }

  if (
    !claimRequest ||
    !claimRequest?.parsed?.isApproved ||
    claimRequest.parsed.counter !== nameEntry.parsed.claimRequestCounter
  ) {
    console.log("Approving claim request");
    const [claimRequestId] = await findClaimRequestId(
      namespaceId,
      entryName,
      new web3.PublicKey(publicKey)
    );

    await withUpdateClaimRequest(
      connection,
      new SignerWallet(wallet),
      NAMESPACE_NAME,
      entryName,
      claimRequestId,
      true,
      transaction
    );
  }

  console.log(`Revoking for ${publicKey} for ${entryName}`);

  const owner = await getOwner(
    secondaryConnectionFor(cluster),
    nameEntry.parsed.mint.toString()
  );
  if (!owner) throw new Error(`No owner for ${entryName} to be revoked`);

  if (nameEntry.parsed.reverseEntry) {
    const reverseEntryId = nameEntry.parsed.reverseEntry;
    console.log(
      `Revoking reverse entry ${reverseEntryId.toString()} using claimId ${claimRequestId.toString()} from owner ${owner.toString()}`
    );
    const reverseEntry = await connection.getAccountInfo(reverseEntryId);
    if (reverseEntry) {
      await withRevokeReverseEntry(
        transaction,
        connection,
        new SignerWallet(wallet),
        NAMESPACE_NAME,
        entryName,
        reverseEntryId,
        claimRequestId
      );
    }
  }

  console.log(
    `Revoking entry ${entryName} using claimId ${claimRequestId.toString()} from owner ${owner.toString()}`
  );

  if (owner.toString() !== namespaceId.toString()) {
    let isMasterEdition = true;
    const masterEditionId = await MasterEdition.getPDA(nameEntry.parsed.mint);
    try {
      await MasterEdition.getInfo(connection, masterEditionId);
    } catch (e) {
      isMasterEdition = false;
    }
    if (!isMasterEdition) {
      await deprecated.withRevokeEntry(
        connection,
        new SignerWallet(wallet),
        NAMESPACE_NAME,
        entryName,
        nameEntry.parsed.mint,
        owner,
        claimRequestId,
        transaction
      );
    } else {
      await withRevokeNameEntry(
        transaction,
        connection,
        new SignerWallet(wallet),
        NAMESPACE_NAME,
        entryName,
        owner,
        nameEntry.parsed.mint,
        claimRequestId
      );
    }
  }

  let txid = "";
  if (transaction.instructions.length > 0) {
    console.log(
      `Executing transaction of length ${transaction.instructions.length}`
    );
    transaction.feePayer = wallet.publicKey;
    transaction.recentBlockhash = (
      await connection.getRecentBlockhash("max")
    ).blockhash;
    txid = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet],
      { skipPreflight: true }
    );
    console.log(
      `Succesfully revoke entries from ${owner.toString()}, txid (${txid})`
    );
  }

  console.log(
    `Succesfully revoked for publicKey (${publicKey}) for handle (${entryName}) txid (${txid})`
  );
  return {
    status: 200,
    txid,
    message: `Succesfully approved claim publicKey (${publicKey}) for handle (${entryName}) txid (${txid})`,
  };
}
