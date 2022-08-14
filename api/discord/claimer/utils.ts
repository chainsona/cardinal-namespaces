/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { findAta } from "@cardinal/common";
import * as namespaces from "@cardinal/namespaces";
import * as splToken from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";
import fetch from "node-fetch";

import type {
  DiscordResponseParams,
  DiscordUserInfoParams,
  DiscordVerificationResponse,
} from "../../tools/types";

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

export const verifyDiscord = async (
  code: string,
  accessToken?: string
): Promise<DiscordVerificationResponse> => {
  // get access token
  const params = new URLSearchParams();
  params.append("client_id", "992004845101916191");
  params.append("client_secret", "D5ZJTxmYUxerC5zubMk4fHSx9veuD8RG");
  params.append("grant_type", "authorization_code");
  params.append("code", code.toString());
  params.append(
    "redirect_uri",
    "http://localhost:3000/verification?identity=discord"
  );
  params.append("scope", "identify");

  if (!accessToken) {
    const response = await fetch("https://discord.com/api/v10//oauth2/token", {
      method: "POST",
      body: params,
      headers: {
        "Content-type": "application/x-www-form-urlencoded",
      },
    });
    const json = await response.json();
    let parsedResponse: DiscordResponseParams | undefined;
    try {
      parsedResponse = json as DiscordResponseParams;
      accessToken = parsedResponse?.access_token;
    } catch (e) {
      return {
        verified: false,
        erroeMessage: "Error parsing server response",
      };
    }
  }

  // get user information
  const userResponse = await fetch("http://discordapp.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const userJson = await userResponse.json();
  let parsedUserResponse: DiscordUserInfoParams | undefined;
  try {
    parsedUserResponse = userJson as DiscordUserInfoParams;
  } catch (e) {
    return {
      verified: false,
      erroeMessage: "Error parsing server response",
    };
  }
  const username = `${parsedUserResponse?.username}#${parsedUserResponse?.discriminator}`;

  const imageURI = `https://cdn.discordapp.com/avatars/${parsedUserResponse?.id}/${parsedUserResponse?.avatar}.png`;
  console.log(`Verified username ${username} with image ${imageURI}`);
  return {
    verified: true,
    info: {
      username: username,
      imageURI: imageURI,
      accessToken: accessToken,
    },
  };
};
