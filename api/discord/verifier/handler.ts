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
      !event?.queryStringParameters?.code ||
      event?.queryStringParameters?.code === "undefined"
    ) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Invalid API request" }),
      };
    } else {
      ("pass");
    }

    const { status, error, info } = await verifier.verify(
      event?.queryStringParameters?.publicKey,
      event?.queryStringParameters?.code,
      event?.queryStringParameters?.accessToken,
      event?.queryStringParameters?.cluster
    );
    return {
      headers: headers,
      statusCode: status,
      body: JSON.stringify({ result: "done", error, info: info }),
    };
  } catch (e) {
    console.log("Error approving claim request: ", e);
    return {
      headers: headers,
      statusCode: 500,
      body: JSON.stringify({ error: (e as string).toString() }),
    };
  }
};
