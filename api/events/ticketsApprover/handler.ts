/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import type { ApproveData } from "../firebase";
import * as approver from "./approver";

module.exports.approve = async (event) => {
  const headers = {
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
  };
  const ticketId = event.pathParameters.ticketId;
  const data = JSON.parse(event.body);

  try {
    if (
      !ticketId ||
      !data.account ||
      !data.email ||
      !data.amount ||
      !data.eventId ||
      !data.ticketName
    ) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Missing approver parameters" }),
      };
    }

    if (!data.companyId) {
      data.companyId = "default";
    }

    const amount = Number(data.amount);
    if (isNaN(amount)) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Invalid amount format" }),
      };
    }
    const response = await approver.approve({
      ticketId: ticketId,
      eventId: data.eventId,
      account: data.account,
      ticketName: data.ticketName,
      email: data.email,
      amount: data.amount,
      companyId: data.companyId,
    } as ApproveData);
    return {
      headers: headers,
      statusCode: response.status,
      body: JSON.stringify({
        result: "done",
        message: response.message || "",
        error: response.error,
      }),
    };
  } catch (e) {
    console.log("Error approving user: ", e);
    return {
      headers: headers,
      statusCode: 500,
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
