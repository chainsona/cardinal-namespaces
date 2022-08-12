import { verifyDiscord } from "../claimer/utils";

export async function verify(
  publicKey: string,
  code?: string,
  accessToken?: string,
  cluster = "mainnet"
): Promise<{ status: number; message?: string; info?: any }> {
  if (!code) {
    return {
      status: 401,
      message: `No code found in request URL`,
    };
  }

  console.log(
    `Attempting to verify discord handle publicKey ${publicKey} cluster ${cluster} `
  );
  const response = await verifyDiscord(code, accessToken);

  if (!response.verified) {
    return {
      status: 500,
      message: response.erroeMessage,
    };
  }

  return {
    status: 200,
    info: response.info,
  };
}
