import { utils } from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import fs from "fs";
import fetch from "node-fetch";

import { tryGetEventFromShortlink } from "../firebase";
import { eventIdFromTicket } from "./create-events";
import { ticketConfig } from "./ticketConfig";

export type TicketCreationData = {
  docId?: string;
  eventId: string;
  ticketShortLink: string;
  ticketName: string;
  ticketQuantity: string;
  ticketPrice: string;
  environment: string;
  creator: string;
  ticketImage: string;
  ticketMetadata: string;
};

const wallet = Keypair.fromSecretKey(utils.bytes.bs58.decode(""));

export function chunkArray<T>(arr: T[], size: number): T[][] {
  return arr.length > size
    ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)]
    : [arr];
}

const BATCH_SIZE = 1;

export const createTickets = async () => {
  const buffer = fs.readFileSync("./events/tools/image.png");
  const image = buffer.toString("base64");

  const mdbuffer = fs.readFileSync("./events/tools/metadata.json");
  const metadata = mdbuffer.toString("base64");

  const ticketDatas = await Promise.all(
    ticketConfig.map(async (t) => {
      const eventId = eventIdFromTicket(t);
      const tryEvent = await tryGetEventFromShortlink(eventId);
      return {
        eventId: tryEvent?.docId,
        ticketShortLink: "",
        ticketName: t.ticketType,
        ticketQuantity: t.quantity,
        ticketPrice: "0",
        environment: "mainnet-beta",
        creator: wallet.publicKey.toString(),
        ticketImage: `data:image/png;base64,${image}`,
        ticketMetadata: `data:application/json;base64,${Buffer.from(
          JSON.stringify({
            name: t.ticketType,
            symbol: "OZUNA",
            description: t.ticketType,
            seller_fee_basis_points: 10000,
            attributes: [
              {
                trait_type: "Special Entrance",
                value: t.specialEntrance,
              },
              {
                trait_type: "Merch",
                value: t.merch,
              },
              {
                trait_type: "Location",
                value: t.location,
              },
              {
                trait_type: "Date",
                value: t.date,
              },
            ],
          })
        ).toString("base64")}`,
      };
    }, [] as TicketCreationData[])
  );

  const ticketDataChunks = chunkArray(ticketDatas, BATCH_SIZE);
  for (const chunks of ticketDataChunks) {
    console.log(chunks[0].eventId);
    const response = await fetch(`http://localhost:8080/dev/tickets`, {
      method: "POST",
      body: JSON.stringify({ data: chunks }),
    });
    console.log(response);
    const json = (await response.json()) as { message?: string };
    console.log(json);
  }

  // const responses = await Promise.all(
  //   ticketDataChunks.map((d) =>
  //     fetch(`https://dev-api.cardinal.so/namespaces/tickets`, {
  //       method: "POST",
  //       body: JSON.stringify({ data: d }),
  //     })
  //   )
  // );
  // console.log(responses);
  // const jsons = await Promise.all(responses.map((r) => r.json()));
  // console.log(jsons);
};

createTickets()
  .then(() => {
    console.log("success");
  })
  .catch((e) => {
    console.log("Error:", e);
  });
