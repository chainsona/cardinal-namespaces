/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import type { OtpClaimData } from "../firebase";
import * as otpClaimer from "./otpClaimer";

module.exports.otpClaim = async (event) => {
  const headers = {
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
  };
  const ticketId = event.pathParameters.ticketId;
  const data = JSON.parse(event.body);

  try {
    if (!ticketId || !data.account || !data.otp) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({
          error: "Missing otp claiming parameters",
        }),
      };
    }

    const response = await otpClaimer.otpClaim(data as OtpClaimData);
    return {
      headers: headers,
      statusCode: response.status,
      body: JSON.stringify({
        result: "done",
        transaction: response.transaction || "",
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
