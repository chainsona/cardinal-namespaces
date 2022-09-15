/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import type { ClaimData } from "../firebase";
import * as claimer from "./claimer";

module.exports.handle = async (event) => {
  const headers = {
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
  };
  const ticketId = event.pathParameters.ticketId;
  const data = JSON.parse(event.body);

  try {
    if (!ticketId || !data.account || !data.amount) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Missing ticket claiming parameters" }),
      };
    }

    const amount = Number(data.amount);
    if (isNaN(amount)) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Invalid amount format" }),
      };
    }
    const response = await claimer.claim({
      ticketId: ticketId,
      account: data.account,
      amount: data.amount,
      formResponse: data.formResponse ?? [],
    } as ClaimData);
    return {
      headers: headers,
      statusCode: response.status,
      body: JSON.stringify({
        result: "done",
        transactions: response.transactions || "",
        transactionDocumentIds: response.transactionDocumentIds || "",
        message: response.message || "",
        error: response.error,
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
