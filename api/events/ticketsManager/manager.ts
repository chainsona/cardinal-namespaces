import { emptyWallet, tryGetAccount } from "@cardinal/common";
import {
  getNamespaceByName,
  withCreateNamespace,
  withUpdateNamespace,
} from "@cardinal/namespaces";
import { Transaction } from "@solana/web3.js";

import { connectionFor } from "../../common/connection";
import { publicKeyFrom } from "../common";
import { eventApproverKeys, EventApproverKind } from "../constants";
import type { FirebaseTicket, TicketCreationData } from "../firebase";
import {
  eventStorage,
  formatUpload,
  getTicketRef,
  tryGetEventTicketByDocId,
  tryGetPayer,
} from "../firebase";

export async function createOrUpdate(
  ticketCreationDatas: TicketCreationData[]
): Promise<{
  status: number;
  transactions?: string[];
  message?: string;
  error?: string;
}> {
  const transactions: string[] = [];
  if (ticketCreationDatas.length === 0) {
    return {
      status: 400,
      message: `No tickets provided`,
    };
  }

  for (const ticket of ticketCreationDatas) {
    const connection = connectionFor(ticket.environment);
    const creatorPublickKey = publicKeyFrom(
      ticket.creator,
      "Invalid creator pubkey"
    );
    const creatorWallet = emptyWallet(creatorPublickKey);
    const checkTicket = await tryGetEventTicketByDocId(
      ticket.eventId,
      ticket.docId
    );
    const ticketRef = getTicketRef(
      ticket.eventId,
      checkTicket ? checkTicket.docId : undefined
    );

    if (!ticket.ticketImage && !checkTicket) {
      throw "Need a ticket image for ticket creation";
    }
    if (!ticket.ticketMetadata && !checkTicket) {
      throw "Need a ticket metadata for ticket creation";
    }

    const transaction = new Transaction();
    // on chain
    const checkNamespace = await tryGetAccount(() =>
      getNamespaceByName(connection, ticketRef.id)
    );

    const supply = Number(ticket.ticketQuantity);
    if (isNaN(supply)) {
      throw "Invalid supply provided";
    }
    const price = Number(ticket.ticketPrice);
    if (isNaN(price)) {
      throw "Invalid supply provided";
    }

    if (!checkNamespace) {
      // no payment amount daily or payment mint
      await withCreateNamespace(transaction, connection, creatorWallet, {
        namespaceName: ticketRef.id,
        updateAuthority: creatorWallet.publicKey,
        rentAuthority: creatorWallet.publicKey,
        approveAuthority: eventApproverKeys[EventApproverKind.None].publicKey,
        transferableEntries: false,
        limit: supply,
        maxExpiration: undefined,
      });
    } else {
      await withUpdateNamespace(
        transaction,
        connection,
        creatorWallet,
        ticketRef.id,
        {
          updateAuthority: creatorWallet.publicKey,
          rentAuthority: creatorWallet.publicKey,
          approveAuthority: eventApproverKeys[EventApproverKind.None].publicKey,
          schema: checkNamespace.parsed.schema,
          paymentAmountDaily: checkNamespace.parsed.paymentAmountDaily,
          paymentMint: checkNamespace.parsed.paymentMint,
          minRentalSeconds: checkNamespace.parsed.minRentalSeconds,
          transferableEntries: checkNamespace.parsed.transferableEntries,
          invalidationType: checkNamespace.parsed.invalidationType,
          maxRentalSeconds: checkNamespace.parsed.maxRentalSeconds ?? undefined,
          limit: supply,
          maxExpiration: checkNamespace.parsed.maxExpiration ?? undefined,
        }
      );
    }
    transaction.feePayer = creatorWallet.publicKey;
    transaction.recentBlockhash = (
      await connection.getRecentBlockhash("max")
    ).blockhash;
    const copiedTx = Transaction.from(
      transaction.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
      })
    );
    const serialized = copiedTx
      .serialize({
        verifySignatures: false,
        requireAllSignatures: false,
      })
      .toString("base64");
    transactions.push(serialized);

    // off chain
    if (ticket.feePayer && ticket.feePayer.length !== 0) {
      const payer = await tryGetPayer(ticket.feePayer);
      if (!payer || payer.authority !== ticket.creator) {
        throw "Invalid ticket fee payer";
      }
    }
    if (!checkTicket) {
      await ticketRef.set({
        docId: ticketRef.id,
        eventId: ticket.eventId,
        ticketShortLink: "",
        ticketName: ticket.ticketName,
        ticketDescription: ticket.ticketDescription,
        ticketQuantity: supply,
        ticketPrice: price,
        feePayer: ticket.feePayer ?? null,
        additionalSigners: ticket.additionalSigners ?? null,
      } as FirebaseTicket);
    } else {
      await ticketRef.update({
        docId: ticketRef.id,
        eventId: ticket.eventId,
        ticketShortLink: "",
        ticketName: ticket.ticketName,
        ticketDescription: ticket.ticketDescription,
        ticketQuantity: supply,
        ticketPrice: price,
        feePayer: ticket.feePayer ?? null,
        additionalSigners: ticket.additionalSigners ?? null,
      } as FirebaseTicket);
    }

    if (
      ticket.ticketImage &&
      ticket.ticketImage.length !== 0 &&
      ticket.ticketImage.substring(0, 5) === "data:"
    ) {
      const contents = formatUpload(ticket.ticketImage);
      const imageFile = eventStorage
        .bucket()
        .file(`tickets/${ticketRef.id}/image.png`);
      await imageFile
        .save(contents, {
          gzip: true,
          contentType: "image/png",
        })
        .then(() => {
          console.log("uploaded ticket image");
        });
    }

    if (
      ticket.ticketMetadata &&
      ticket.ticketMetadata.length !== 0 &&
      ticket.ticketMetadata.substring(0, 5) === "data:"
    ) {
      console.log("ticket.ticketMetadata", ticket.ticketMetadata);
      const contents = formatUpload(ticket.ticketMetadata, true);
      const metadataFile = eventStorage
        .bucket()
        .file(`tickets/${ticketRef.id}/metadata.json`);
      await metadataFile
        .save(JSON.stringify(JSON.parse(contents.toString())), {
          contentType: "application/json",
        })
        .then(() => {
          console.log("uploaded ticket metadata");
        });
    }
  }

  return {
    status: 200,
    transactions: transactions,
    message: `Built transaction to create ticket`,
  };
}
