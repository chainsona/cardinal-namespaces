/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import * as verifier from "./verifier";

module.exports.verify = async (event) => {
  const headers = {
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
  };
  try {
    if (
      !event?.queryStringParameters?.publicKey ||
      event?.queryStringParameters?.publicKey === "undefined"
    ) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Invalid API request" }),
      };
    }
    // custom params for each identity namespace
    if (
      !event?.queryStringParameters?.tweetId ||
      event?.queryStringParameters?.tweetId === "undefined" ||
      !event?.queryStringParameters?.handle ||
      event?.queryStringParameters?.handle === "undefined"
    ) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Invalid API request" }),
      };
    } else {
      ("pass");
    }

    const { status, handle, message } = await verifier.verifyTweet(
      event?.queryStringParameters?.publicKey,
      event?.queryStringParameters?.handle,
      event?.queryStringParameters?.tweetId,
      event?.queryStringParameters?.cluster
    );
    return {
      headers: headers,
      statusCode: status,
      body: JSON.stringify({
        result: "done",
        message,
        handle: handle,
      }),
    };
  } catch (e) {
    console.log(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Error verifying handle ${event?.queryStringParameters?.handle}`
    );
    return {
      headers: headers,
      statusCode: 500,
      body: JSON.stringify({
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        error: `Error verifying handle ${event?.queryStringParameters?.handle}`,
      }),
    };
  }
};
