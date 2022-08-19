import fetch from "node-fetch";

import type {
  GithubResponseParams,
  GithubUserInfoParams,
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
    `Attempting to verify github handle publicKey ${publicKey} cluster ${cluster} `
  );

  // get access token
  const params = new URLSearchParams();
  params.append("client_id", "46fd12e1745bd062a3b4");
  params.append("client_secret", process.env.GITHUB_CLIENT_SECRET || "");
  params.append("grant_type", "authorization_code");
  params.append("code", code.toString());
  params.append(
    "redirect_uri",
    "http://localhost:3000/verification?identity=github"
  );

  if (!accessToken) {
    console.log(params);
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        body: params,
        headers: {
          Accept: "application/json",
        },
      }
    );
    const json = (await response.json()) as GithubResponseParams;
    console.log("json", json);
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
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `token ${accessToken}`,
    },
  });
  const userJson = (await userResponse.json()) as GithubUserInfoParams;
  let parsedUserResponse: GithubUserInfoParams | undefined;
  try {
    parsedUserResponse = userJson;
  } catch (e) {
    return {
      status: 500,
      error: "Error parsing server response",
    };
  }

  console.log("Received user reponse", parsedUserResponse);
  if (!parsedUserResponse?.login) {
    return {
      status: 500,
      error: "Verification failed",
    };
  }

  const handle = parsedUserResponse.login;
  const profileUrl = parsedUserResponse.avatar_url;
  console.log(`Verified username ${handle} with image ${profileUrl}`);
  return {
    status: 200,
    accessToken,
    handle,
    profileUrl,
  };
}
