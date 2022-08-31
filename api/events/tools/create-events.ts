import { utils } from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import fs from "fs";
import fetch from "node-fetch";

import { tryGetEventFromShortlink } from "../firebase";
import type { TicketConfig } from "./ticketConfig";
import { ticketConfig } from "./ticketConfig";

export type EventData = {
  shortLink: string;
  eventName: string;
  eventLocation: string;
  eventDescription: string;
  eventStartTime: string;
  eventEndTime: string;
  creatorId: string;
  environment: string;
  eventBannerImage?: string;
};

const wallet = Keypair.fromSecretKey(utils.bytes.bs58.decode(""));

export const eventIdFromTicket = (t: TicketConfig) =>
  `ozuna-${
    t.location
      ?.toLowerCase()
      .replace(" ", "-")
      .replace(",", "")
      .replace(" ", "-") ?? ""
  }-${t.date ?? ""}`;

export const eventsFromTickets = (tickets: TicketConfig[]) => {
  return tickets.reduce((acc, t) => {
    const eventId = eventIdFromTicket(t);
    if (eventId in acc) {
      return acc;
    }
    const buffer = fs.readFileSync("./events/tools/banner.png");
    const banner = buffer.toString("base64");

    return {
      ...acc,
      [eventId]: {
        shortLink: eventId,
        eventName: `Ozuna World Tour: ${t.location ?? ""}`,
        eventLocation: t.location ?? "Global",
        eventDescription: `Ozuna World Tour: ${t.location ?? ""}`,
        eventStartTime: t.date ? new Date(t.date).toISOString() : "",
        eventEndTime: t.date ? new Date(t.date).toISOString() : "",
        creatorId: wallet.publicKey.toString(),
        eventBannerImage: `data:image/png;base64,${banner}`,
        environment: "mainnet-beta",
      },
    };
  }, {} as { [k: string]: EventData });
};

export const createEvents = async () => {
  const eventData = eventsFromTickets(ticketConfig);
  console.log(eventData);
  const eventDatas = Object.values(eventData);
  for (const event of eventDatas) {
    const response = await fetch(
      `https://dev-api.cardinal.so/namespaces/events`,
      {
        method: "POST",
        body: JSON.stringify({ data: [event] }),
      }
    );
    const json = (await response.json()) as string;
    console.log(json);
  }
  console.log("Updated events");
};

export const updateEvents = async () => {
  const eventData = eventsFromTickets(ticketConfig);
  const eventDatas = Object.values(eventData);
  for (const event of eventDatas) {
    const tryEvent = await tryGetEventFromShortlink(event.shortLink);
    if (!tryEvent) {
      console.log(`Event with link ${event.shortLink} not found`);
    } else {
      const response = await fetch(
        `https://dev-api.cardinal.so/namespaces/events/${tryEvent.docId}`,
        {
          method: "PUT",
          body: JSON.stringify(event),
        }
      );
      const json = (await response.json()) as { message?: string };
      console.log(json);
    }
  }
  console.log("Updated events");
};

// updateEvents()
//   .then(() => {
//     console.log("success");
//   })
//   .catch((e) => {
//     console.log("Error:", e);
//   });
// createEvents()
//   .then(() => {
//     console.log("success");
//   })
//   .catch((e) => {
//     console.log("Error:", e);
//   });
