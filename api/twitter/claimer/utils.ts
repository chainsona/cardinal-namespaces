import { findAta } from "@cardinal/common";
import * as namespaces from "@cardinal/namespaces";
import * as splToken from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";
import fetch from "node-fetch";

export const TWITTER_API_KEYS = process.env.TWITTER_API_KEYS
  ? process.env.TWITTER_API_KEYS.split(",")
  : [];

export type TweetJson = {
  errors?: { title: string }[];
  data: { text: string };
  includes: { users: { username: string }[] };
};

export const tweetContainsPublicKey = async (
  tweetId: string,
  entryName: string,
  publicKey: string
): Promise<boolean> => {
  let tweetJson: TweetJson | undefined;
  let userHandle: string | undefined;
  for (let i = 0; i < TWITTER_API_KEYS.length; i++) {
    if (!userHandle) {
      try {
        const tweetResponse = await fetch(
          `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=created_at&expansions=author_id`,
          {
            headers: {
              authorization: `Bearer ${TWITTER_API_KEYS[i]!}`,
            },
          }
        );
        tweetJson = (await tweetResponse.json()) as TweetJson;
        userHandle = tweetJson.includes.users[0].username;
      } catch (e) {
        console.log("Invalid twitter API response", e);
        if (i === TWITTER_API_KEYS.length - 1) {
          if (
            tweetJson?.errors &&
            tweetJson?.errors[0].title === "Authorization Error"
          ) {
            throw new Error("Cannot read tweet because account is private");
          } else {
            throw new Error(`Invalid twitter API response`);
          }
        }
      }
    }
  }
  if (userHandle !== entryName) {
    throw new Error(
      `Handle ${userHandle || ""} does not match requested name ${entryName}`
    );
  }
  return tweetJson?.data.text.includes(publicKey) ?? false;
};

export const tryGetAta = async (
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey
): Promise<splToken.AccountInfo | undefined> => {
  try {
    const namespaceTokenAccountId = await findAta(mint, owner, true);
    const tokenMint = new splToken.Token(
      connection,
      mint,
      splToken.TOKEN_PROGRAM_ID,
      Keypair.generate()
    );
    return tokenMint.getAccountInfo(namespaceTokenAccountId);
  } catch (e) {
    console.log("Failed to get ata");
  }
};

export async function tryGetNameEntry(
  connection: Connection,
  namespaceName: string,
  entryName: string
) {
  try {
    const entry = await namespaces.getNameEntry(
      connection,
      namespaceName,
      entryName
    );
    return entry;
  } catch (e) {
    return null;
  }
}

export async function tryGetClaimRequest(
  connection: Connection,
  namespaceName: string,
  entryName: string,
  user: PublicKey
) {
  try {
    const entry = await namespaces.getClaimRequest(
      connection,
      namespaceName,
      entryName,
      user
    );
    return entry;
  } catch (e) {
    console.log("Failed to get claim request:", e);
    return null;
  }
}
