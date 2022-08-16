/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { tryPublicKey } from "@cardinal/common";

import * as migrate from "./migrate";

module.exports.migrate = async (event) => {
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

    // account for special characters
    const response = await migrate.migrate(
      account,
      event?.queryStringParameters?.handle,
      event?.queryStringParameters?.cluster
    );
    return {
      headers: headers,
      statusCode: response.status,
      body: JSON.stringify({
        result: "done",
        transactions: response.transactions || "",
        message: response.message || "",
        mintId: response.mintId || "",
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
