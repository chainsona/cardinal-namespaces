/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import * as revoker from "./revoker";

module.exports.revoke = async (event) => {
  const headers = {
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
  };
  try {
    if (
      !event?.queryStringParameters?.tweetId ||
      event?.queryStringParameters?.tweetId === "undefined"
    ) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Invalid API request" }),
      };
    }
    const { status, txid, message } = await revoker.revokeHolder(
      event?.queryStringParameters?.publicKey,
      event?.queryStringParameters?.handle,
      event?.queryStringParameters?.tweetId,
      event?.queryStringParameters?.cluster
    );
    return {
      statusCode: status,
      headers: {
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Origin": "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
      },
      body: JSON.stringify({ result: "done", txid, message }),
    };
  } catch (e) {
    console.log("Error: ", e);
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
