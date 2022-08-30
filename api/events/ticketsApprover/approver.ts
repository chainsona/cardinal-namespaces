/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { emptyWallet, tryGetAccount, tryPublicKey } from "@cardinal/common";
import {
  getNamespaceByName,
  withApproveClaimRequest,
} from "@cardinal/namespaces";
import { utils } from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";

import { connectionFor } from "../../common/connection";
import {
  PAYMENT_MINTS_DECIMALS_MAPPING,
  withHandlePayment,
} from "../../common/payments";
import { sendEmail } from "../common";
import { eventApproverKeys } from "../constants";
import type { ApproveData } from "../firebase";
import { tryGetEvent, tryGetEventTicket } from "../firebase";

const BATCH_SIZE = 8;

export async function approve(data: ApproveData): Promise<{
  status: number;
  message?: string;
  error?: string;
}> {
  const checkTicket = await tryGetEventTicket(data.ticketId);
  if (!checkTicket) {
    return {
      status: 400,
      message: JSON.stringify({ message: "Ticket not found" }),
    };
  }
  const checkEvent = await tryGetEvent(checkTicket.eventId);
  if (!checkEvent) {
    return {
      status: 400,
      message: JSON.stringify({ message: "Event for ticket not found" }),
    };
  }

  const approverPublicKey = tryPublicKey(data.account);
  if (!approverPublicKey) {
    return {
      status: 400,
      message: `Invalid approver pubkey`,
    };
  }
  const approverWallet = emptyWallet(approverPublicKey);

  const connection = connectionFor(checkEvent.environment);
  const claimAmount = Number(data.amount);
  const claimURLs: string[] = [];

  const checkNamespace = await tryGetAccount(() =>
    getNamespaceByName(connection, data.ticketId)
  );
  if (!checkNamespace?.parsed) {
    return {
      status: 400,
      message: `No ticket namespace found`,
    };
  }

  let approverAuthority: Keypair | undefined;
  try {
    if (checkNamespace.parsed.approveAuthority) {
      const eventApprover = Object.values(eventApproverKeys).find((v) =>
        v.publicKey.equals(checkNamespace.parsed.approveAuthority!)
      );
      if (eventApprover?.secretKey) {
        approverAuthority = Keypair.fromSecretKey(
          utils.bytes.bs58.decode(process.env[eventApprover?.secretKey] ?? "")
        );
      }
    }
  } catch {
    throw `Events pk incorrect or not found`;
  }

  if (!approverAuthority) {
    throw "No approve authority found";
  }

  let transaction = new Transaction();
  for (let i = 0; i < claimAmount; i++) {
    if (checkEvent.eventPaymentMint) {
      const paymentMint = new PublicKey(checkEvent.eventPaymentMint);
      if (!(paymentMint.toString() in PAYMENT_MINTS_DECIMALS_MAPPING)) {
        throw "Missing event payment mint decimals";
      }
      const mintDecimals =
        PAYMENT_MINTS_DECIMALS_MAPPING[paymentMint.toString()];
      const ticketPrice = Number(checkTicket.ticketPrice);
      const amountToPay = ticketPrice * 10 ** mintDecimals;
      await withHandlePayment(
        transaction,
        connection,
        new PublicKey(checkEvent.creatorId),
        approverWallet,
        new PublicKey(checkEvent.eventPaymentMint),
        amountToPay,
        mintDecimals
      );
    }

    const entryName = `${Math.random().toString(36).slice(2)}`;
    const keypair = new Keypair();
    await withApproveClaimRequest(
      transaction,
      connection,
      new SignerWallet(approverAuthority),
      {
        namespaceName: data.ticketId,
        entryName: entryName,
        user: keypair.publicKey,
        approveAuthority: approverAuthority.publicKey,
      }
    );
    if (
      transaction.instructions.length === BATCH_SIZE ||
      i === claimAmount - 1
    ) {
      console.log(
        `Executing approve claim request transaction for ${transaction.instructions.length} tickets`
      );
      transaction.feePayer = approverAuthority.publicKey;
      transaction.recentBlockhash = (
        await connection.getRecentBlockhash("max")
      ).blockhash;
      const txid = await sendAndConfirmTransaction(connection, transaction, [
        approverAuthority,
      ]);
      console.log(`Successfully executed transaction ${txid}`);
      transaction = new Transaction();
    }
    const claimURL = `https://events.cardinal.so/${data.companyId}/${
      checkEvent.shortLink
    }/claim?otp=${utils.bytes.bs58.encode(keypair.secretKey)}&ticketId=${
      data.ticketId
    }&entryName=${entryName}&cluster=${checkEvent.environment}`;
    claimURLs.push(claimURL);
    console.log(
      `Successfuly approved claim URLs by ${data.account.toString()}: ${claimURL}`
    );
  }

  const eventURL = `ttps://identity.cardinal.so/${data.companyId}/${checkEvent.shortLink}`;
  await sendEmail(
    data.email,
    checkEvent.eventName,
    checkTicket.ticketName,
    eventURL,
    claimURLs
  );
  console.log(`Successfuly sent email to user: ${data.email}`);
  return {
    status: 200,
    message: JSON.stringify({ message: "Applicant Approval succeeded" }),
  };
}
