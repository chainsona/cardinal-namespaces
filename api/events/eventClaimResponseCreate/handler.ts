/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import type { ClaimResponseData } from "../firebase";
import { createEventClaimResponse } from "./create";

module.exports.handle = async (event) => {
  const headers = {
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
  };
  try {
    const formResponseData = JSON.parse(event.body) as ClaimResponseData;
    if (
      !formResponseData.account ||
      !formResponseData.eventId ||
      !formResponseData.formResponse
    ) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Missing form response parameters" }),
      };
    }

    const response = await createEventClaimResponse(formResponseData);
    return {
      headers: headers,
      statusCode: response.status,
      body: JSON.stringify({
        message: response.message,
        error: response.error,
      }),
    };
  } catch (e) {
    console.log("Error creating event: ", e);
    return {
      headers: headers,
      statusCode: 500,
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
