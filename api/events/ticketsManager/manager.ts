import { emptyWallet, tryGetAccount, tryPublicKey } from "@cardinal/common";
import {
  getNamespaceByName,
  withCreateNamespace,
  withUpdateNamespace,
} from "@cardinal/namespaces";
import { Transaction } from "@solana/web3.js";
import { setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadString } from "firebase/storage";

import { connectionFor } from "../../common/connection";
import { eventApproverKeys, EventApproverKind } from "../constants";
import type { TicketCreationData } from "../firebase";
import {
  eventStorage,
  getTicketRef,
  tryGetEvent,
  tryGetEventTicketByName,
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
    const creatorPublickKey = tryPublicKey(ticket.creator);
    const eventId = ticketCreationDatas[0].eventId;
    const checkEvent = await tryGetEvent(eventId);
    if (!checkEvent) {
      return {
        status: 400,
        message: `No even found for tickets`,
      };
    }

    if (!creatorPublickKey) {
      return {
        status: 400,
        message: `Invalid creator pubkey`,
      };
    }
    const creatorWallet = emptyWallet(creatorPublickKey);

    const checkTicket = await tryGetEventTicketByName(
      ticket.eventId,
      ticket.ticketName
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
    if (!checkTicket) {
      await setDoc(ticketRef, {
        docId: ticketRef.id,
        eventId: ticket.eventId,
        ticketShortLink: "",
        ticketName: ticket.ticketName,
        ticketQuantity: supply,
        ticketPrice: price,
      });
    } else {
      await updateDoc(ticketRef, {
        docId: ticketRef.id,
        eventId: ticket.eventId,
        ticketShortLink: "",
        ticketName: ticket.ticketName,
        ticketQuantity: supply,
        ticketPrice: price,
      });
    }

    if (ticket.ticketImage && ticket.ticketImage.length !== 0) {
      const ticketImageRef = ref(
        eventStorage,
        `tickets/${ticketRef.id}/image.png`
      );
      await uploadString(ticketImageRef, ticket.ticketImage, "data_url");
    }

    if (ticket.ticketMetadata && ticket.ticketMetadata.length !== 0) {
      const ticketMetadataRef = ref(
        eventStorage,
        `tickets/${ticketRef.id}/metadata.png`
      );
      await uploadString(ticketMetadataRef, ticket.ticketMetadata, "data_url");
    }
  }

  return {
    status: 200,
    transactions: transactions,
    message: `Built transaction to create ticket`,
  };
}
