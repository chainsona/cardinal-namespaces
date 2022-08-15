/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { shortenAddress } from "@cardinal/namespaces";
import * as anchor from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";

import { claimTransaction } from "../../common/claimTransaction";
import { connectionFor } from "../../common/connection";
import { tweetContainsPublicKey } from "./utils";

const NAMESPACE_NAME = "twitter";

export async function claim(
  publicKey: string,
  entryName: string,
  tweetId?: string,
  cluster = "mainnet"
): Promise<{
  status: number;
  transactions?: string[];
  transaction?: string;
  message?: string;
}> {
  const connection = connectionFor(cluster);
  let approverAuthority: Keypair | undefined;
  try {
    approverAuthority = Keypair.fromSecretKey(
      anchor.utils.bytes.bs58.decode(process.env.TWITTER_SOLANA_KEY || "")
    );
  } catch {
    throw new Error(`Twitter pk incorrect or not found`);
  }

  console.log(
    `Attempting to approve tweet for tweet (${tweetId!}) publicKey ${publicKey} entryName ${entryName} cluster ${cluster} `
  );

  // check tweet
  let tweetApproved = true;
  if (cluster !== "devnet") {
    try {
      tweetApproved = await tweetContainsPublicKey(
        tweetId!,
        entryName,
        publicKey
      );
      console.log(tweetApproved);
    } catch (e) {
      console.log("Failed twitter check: ", e);
      return {
        status: 401,
        message: e.message,
      };
    }
  }

  if (!tweetApproved) {
    return {
      status: 404,
      message: `Public key ${shortenAddress(
        publicKey
      )} not found in tweet ${tweetId!}`,
    };
  }

  const transactions = await claimTransaction(
    connection,
    NAMESPACE_NAME,
    publicKey,
    entryName,
    approverAuthority
  );

  return {
    status: 200,
    transactions: transactions,
    transaction: transactions[transactions.length - 1],
    message: `Returned succesfull transaction for ${publicKey} to claim handle (${entryName})`,
  };
}
