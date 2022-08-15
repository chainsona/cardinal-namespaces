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
): Promise<{ status: number; error?: string; info?: any }> {
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
    const json = (await response.json()) as DiscordResponseParams;
    let parsedResponse: DiscordResponseParams | undefined;
    console.log("Received response", json);
    try {
      parsedResponse = json;
      accessToken = parsedResponse?.access_token;
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

  const username = `${parsedUserResponse?.username}#${parsedUserResponse?.discriminator}`;

  const imageURI = `https://cdn.discordapp.com/avatars/${parsedUserResponse?.id}/${parsedUserResponse?.avatar}.png`;
  console.log(`Verified username ${username} with image ${imageURI}`);
  return {
    status: 200,
    info: {
      username: username,
      imageURI: imageURI,
      accessToken: accessToken,
    },
  };
}
