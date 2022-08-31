/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import type { TicketCreationData } from "../firebase";
import * as manager from "./manager";

module.exports.handle = async (event) => {
  const headers = {
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
  };
  const ticketCreationDatas = JSON.parse(event.body) as TicketCreationData[];

  try {
    if (ticketCreationDatas.length === 0) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "No tickets to be created" }),
      };
    }
    for (const tix of ticketCreationDatas) {
      if (
        !tix.eventId ||
        !tix.ticketName ||
        !tix.ticketQuantity ||
        !tix.ticketPrice ||
        !tix.environment ||
        !tix.creator
      ) {
        return {
          headers: headers,
          statusCode: 412,
          body: JSON.stringify({ error: "Missing event creation parameters" }),
        };
      }
      const supply = Number(tix.ticketQuantity);
      if (isNaN(supply)) {
        return {
          headers: headers,
          statusCode: 412,
          body: JSON.stringify({
            error: `Invalid ticket quantity format for ${tix.ticketName}`,
          }),
        };
      }
      const ticketPrice = Number(tix.ticketPrice);
      if (isNaN(ticketPrice)) {
        return {
          headers: headers,
          statusCode: 412,
          body: JSON.stringify({
            error: `Invalid ticket quantity format for ${tix.ticketName}`,
          }),
        };
      }
    }

    const response = await manager.createOrUpdate(ticketCreationDatas);
    return {
      headers: headers,
      statusCode: response.status,
      body: JSON.stringify({
        result: "done",
        transactions: response.transactions || [],
        message: response.message || "",
        error: response.error,
      }),
    };
  } catch (e) {
    console.log("Error building create transaction: ", e);
    return {
      headers: headers,
      statusCode: 500,
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
