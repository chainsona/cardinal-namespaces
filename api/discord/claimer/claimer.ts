/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */ import * as anchor from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import fetch from "node-fetch";

import { claimTransaction } from "../../common/claimTransaction";
import { connectionFor } from "../../common/connection";

const NAMESPACE_NAME = "discord";

type UserInfoParams = {
  id: string;
  username: string;
  avatar: string;
};

export async function claim(
  publicKey: string,
  entryName: string,
  accessToken?: string,
  cluster = "mainnet"
): Promise<{ status: number; transactions?: string[]; message?: string }> {
  const connection = connectionFor(cluster);
  let approverAuthority: Keypair | undefined;
  try {
    approverAuthority = Keypair.fromSecretKey(
      anchor.utils.bytes.bs58.decode(process.env.DISCORD_SOLANA_KEY || "")
    );
  } catch {
    throw new Error(`${NAMESPACE_NAME} pk incorrect or not found`);
  }

  console.log(
    `Attempting to approve discord handle publicKey ${publicKey} entryName ${entryName} cluster ${cluster} `
  );
  const userResponse = await fetch("http://discordapp.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken!}`,
    },
  });
  const userJson = await userResponse.json();
  let parsedUserResponse: UserInfoParams | undefined;
  try {
    parsedUserResponse = userJson as UserInfoParams;
    if (encodeURIComponent(parsedUserResponse.username) === entryName) {
      return {
        status: 401,
        message: "Could not verify entry name",
      };
    }
  } catch (e) {
    return {
      status: 401,
      message: "Error parsing server response",
    };
  }

  const transactions = await claimTransaction(
    connection,
    NAMESPACE_NAME,
    publicKey,
    entryName,
    approverAuthority
  );

  console.log(`Approving ${publicKey} for ${entryName}`);
  return {
    status: 200,
    transactions: transactions,
    message: `Returned succesfull transaction for ${publicKey} to claim handle (${entryName})`,
  };
}
