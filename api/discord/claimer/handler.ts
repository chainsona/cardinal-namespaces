/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { tryPublicKey } from "@cardinal/common";

import * as claimer from "./claimer";

module.exports.claim = async (event) => {
  const headers = {
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
  };
  const data = JSON.parse(event.body);
  const account = data.account as string;
  try {
    if (
      !account ||
      !tryPublicKey(account) ||
      !event?.queryStringParameters?.handle ||
      event?.queryStringParameters?.handle === "undefined"
    ) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Invalid API request" }),
      };
    }

    // custom params for each identity namespace
    if (
      !event?.queryStringParameters?.accessToken ||
      event?.queryStringParameters?.accessToken === "undefined"
    ) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Invalid API request" }),
      };
    } else {
      ("pass");
    }

    const response = await claimer.claim(
      account,
      event?.queryStringParameters?.handle,
      event?.queryStringParameters?.accessToken,
      event?.queryStringParameters?.cluster
    );
    return {
      headers: headers,
      statusCode: response.status,
      body: JSON.stringify({
        result: "done",
        transactions: response.transactions || "",
        message: response.message || "",
      }),
    };
  } catch (e) {
    console.log("Error building claim transaction: ", e);
    return {
      headers: headers,
      statusCode: 500,
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
