/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import type { EventData } from "../firebase";
import { createEvent } from "./create";

module.exports.handle = async (event) => {
  const headers = {
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
  };
  try {
    const eventCreationDatas = JSON.parse(event.body) as EventData[];
    if (eventCreationDatas.length > 1) {
      throw "Cannot create more than one event at a time";
    }
    const eventCreationData = eventCreationDatas[0];
    if (
      !eventCreationData.shortLink ||
      !eventCreationData.eventName ||
      !eventCreationData.eventLocation ||
      !eventCreationData.eventDescription ||
      !eventCreationData.eventStartTime ||
      !eventCreationData.eventEndTime ||
      !eventCreationData.creatorId ||
      !eventCreationData.environment
    ) {
      return {
        headers: headers,
        statusCode: 412,
        body: JSON.stringify({ error: "Missing event creation parameters" }),
      };
    }
    const response = await createEvent(eventCreationData);
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
