import fetch from "node-fetch";

import type {
  DiscordResponseParams,
  DiscordUserInfoParams,
} from "../../tools/types";

export async function verify(
  publicKey: string,
  code?: string,
  accessToken?: string,
  cluster = "mainnet"
): Promise<{
  status: number;
  error?: string;
  accessToken?: string;
  handle?: string;
  profileUrl?: string;
}> {
  if (!code) {
    return {
      status: 401,
      error: `No code found in request URL`,
    };
  }

  console.log(
    `Attempting to verify discord handle publicKey ${publicKey} cluster ${cluster} `
  );

  // get access token
  const params = new URLSearchParams();
  params.append("client_id", process.env.DISCORD_CLIENT_ID || "");
  params.append("client_secret", process.env.DISCORD_CLIENT_SECRET || "");
  params.append("grant_type", "authorization_code");
  params.append("code", code.toString());
  params.append("redirect_uri", "https://discord.cardinal.so/verification");
  params.append("scope", "identify");

  if (!accessToken) {
    const response = await fetch("https://discord.com/api/v10//oauth2/token", {
      method: "POST",
      body: params,
      headers: {
        "Content-type": "application/x-www-form-urlencoded",
      },
    });
    const json = (await response.json()) as DiscordResponseParams;
    console.log("Received response", json);
    try {
      accessToken = json.access_token;
    } catch (e) {
      return {
        status: 500,
        error: "Error parsing server response",
      };
    }
  }

  // get user information
  const userResponse = await fetch("http://discordapp.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const userJson = (await userResponse.json()) as DiscordUserInfoParams;
  let parsedUserResponse: DiscordUserInfoParams | undefined;
  try {
    parsedUserResponse = userJson;
  } catch (e) {
    return {
      status: 500,
      error: "Error parsing server response",
    };
  }

  console.log("Received user reponse", parsedUserResponse);
  if (!parsedUserResponse?.username) {
    return {
      status: 500,
      error: "Verification failed",
    };
  }

  const handle = `${parsedUserResponse.username}#${parsedUserResponse.discriminator}`;

  const profileUrl = `https://cdn.discordapp.com/avatars/${parsedUserResponse.id}/${parsedUserResponse.avatar}.png`;
  console.log(`Verified username ${handle} with image ${profileUrl}`);
  return {
    status: 200,
    accessToken,
    handle,
    profileUrl,
  };
}
