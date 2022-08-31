import { utils } from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
import {
  Connection,
  Keypair,
  sendAndConfirmRawTransaction,
  Transaction,
} from "@solana/web3.js";
import fs from "fs";
import fetch from "node-fetch";

import { tryGetEventFromShortlink } from "../firebase";
import { getAuthToken } from "./auth";
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
  additionalSigners?: string[];
};

export function chunkArray<T>(arr: T[], size: number): T[][] {
  return arr.length > size
    ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)]
    : [arr];
}

const BATCH_SIZE = 4;

export const createTickets = async () => {
  const wallet = Keypair.fromSecretKey(utils.bytes.bs58.decode(""));
  const buffer = fs.readFileSync("./events/tools/image.png");
  const image = buffer.toString("base64");

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
        additionalSigners: ["ozuJAEJtCLPPTYNicqSvj8hgQEDvy8xyEK2txG5UW3G"],
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

  const connection = new Connection("https://api.devnet.solana.com");
  const ticketDataChunks = chunkArray(ticketDatas, BATCH_SIZE);
  // for (let i = 0; i < ticketDataChunks.length; i++) {
  //   const chunks = ticketDataChunks[i];
  //   const response = await fetch(
  //     `https://dev-api.cardinal.so/namespaces/tickets`,
  //     {
  //       method: "POST",
  //       body: JSON.stringify({ data: chunks }),
  //     }
  //   );
  //   console.log(`${i}/${ticketDataChunks.length} response`, response);
  //   const json = (await response.json()) as {
  //     message?: string;
  //     transactions: string[];
  //   };
  //   const encodedTxs = json.transactions;
  //   const transactions = encodedTxs.map((tx) =>
  //     Transaction.from(Buffer.from(decodeURIComponent(tx), "base64"))
  //   );

  //   if (transactions) {
  //     await new SignerWallet(wallet).signAllTransactions(transactions);
  //     await Promise.all(
  //       transactions.map(async (tx) => {
  //         try {
  //           const txid = await sendAndConfirmRawTransaction(
  //             connection,
  //             tx.serialize(),
  //             {
  //               skipPreflight: true,
  //             }
  //           );
  //           console.log(
  //             `Succesful transaction for ticket https://explorer.solana.com/tx/${txid} ticket (${chunks
  //               .map((c) => c.eventId)
  //               .join(",")})`
  //           );
  //         } catch (e) {
  //           console.log(e);
  //         }
  //       })
  //     );
  //   }
  // }

  const responses = await Promise.all(
    ticketDataChunks.map((d) =>
      fetch(`https://dev-api.cardinal.so/namespaces/tickets`, {
        method: "POST",
        body: JSON.stringify(d),
        headers: {
          Authorization: `${getAuthToken(wallet, "tickets-update")}`,
        },
      })
    )
  );
  const results = await Promise.all(
    responses.map(async (response, i) => {
      const json = (await response.json()) as {
        message?: string;
        transactions: string[];
      };
      console.log(json);
      const encodedTxs = json.transactions;
      const transactions = encodedTxs.map((tx) =>
        Transaction.from(Buffer.from(decodeURIComponent(tx), "base64"))
      );

      if (transactions) {
        await new SignerWallet(wallet).signAllTransactions(transactions);
        await Promise.all(
          transactions.map(async (tx) => {
            try {
              const txid = await sendAndConfirmRawTransaction(
                connection,
                tx.serialize(),
                {
                  skipPreflight: true,
                }
              );
              console.log(
                `Succesful transaction for ticket https://explorer.solana.com/tx/${txid} ticket (${ticketDataChunks[
                  i
                ]
                  .map((c) => c.eventId)
                  .join(",")})`
              );
            } catch (e) {
              console.log(e);
            }
          })
        );
      }
    })
  );
  console.log(results);
};

createTickets()
  .then(() => {
    console.log("success");
  })
  .catch((e) => {
    console.log("Error:", e);
  });
