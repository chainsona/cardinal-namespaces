/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { emptyWallet, tryGetAccount, tryPublicKey } from "@cardinal/common";
import {
  getNamespaceByName,
  withApproveClaimRequest,
} from "@cardinal/namespaces";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { collection, doc, setDoc, Timestamp } from "firebase/firestore";

import { withInitAndClaim } from "../../common/claimUtils";
import { connectionFor } from "../../common/connection";
import {
  PAYMENT_MINTS_DECIMALS_MAPPING,
  withHandlePayment,
} from "../../common/payments";
import { eventApproverKeys } from "../constants";
import type { ClaimData } from "../firebase";
import { eventFirestore, tryGetEvent, tryGetEventTicket } from "../firebase";

export async function claim(data: ClaimData): Promise<{
  status: number;
  transactions?: string[];
  transactionDocumentIds?: string[];
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
  const connection = connectionFor(checkEvent.environment);
  const claimerPublicKey = tryPublicKey(data.account);
  if (!claimerPublicKey) {
    return {
      status: 400,
      message: `Invalid claimer pubkey`,
    };
  }
  const claimerWallet = emptyWallet(claimerPublicKey);

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
      approverAuthority = Object.values(eventApproverKeys).find((v) =>
        v.publicKey.equals(checkNamespace.parsed.approveAuthority!)
      );
    }
  } catch {
    throw new Error(`Events pk incorrect or not found`);
  }

  if (!approverAuthority) {
    throw "No approve authority found";
  }

  const amount = Number(data.amount);
  if (isNaN(amount)) {
    throw "Invalid supply provided";
  }

  const serializedTransactions: string[] = [];
  const transactionDocumentIds: string[] = [];
  for (let i = 0; i < amount; i++) {
    const transaction = new Transaction();
    const entryName = `${Math.random().toString(36).slice(2)}`;

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
        claimerWallet,
        new PublicKey(checkEvent.eventPaymentMint),
        amountToPay,
        mintDecimals
      );
    }

    await withApproveClaimRequest(transaction, connection, claimerWallet, {
      namespaceName: data.ticketId,
      entryName: entryName,
      user: claimerWallet.publicKey,
      approveAuthority: approverAuthority?.publicKey,
    });

    const mintKeypair = Keypair.generate();
    await withInitAndClaim(
      connection,
      claimerWallet,
      transaction,
      data.ticketId,
      entryName,
      mintKeypair
    );

    const firstInstruction = transaction.instructions[0];
    transaction.instructions = [
      {
        ...firstInstruction,
        keys: [
          ...firstInstruction.keys,
          ...(checkTicket.additionalSigners || []).map((s) => ({
            pubkey: new PublicKey(s),
            isSigner: true,
            isWritable: false,
          })),
        ],
      },
      ...transaction.instructions.slice(1),
    ];

    transaction.feePayer =
      checkTicket.additionalSigners &&
      checkTicket.additionalSigners.length > 0 &&
      ((checkTicket.feePayer &&
        checkTicket.additionalSigners.includes(checkTicket.feePayer)) ||
        checkTicket.additionalSigners[0] ===
          "ozuJAEJtCLPPTYNicqSvj8hgQEDvy8xyEK2txG5UW3G")
        ? new PublicKey(checkTicket.additionalSigners[0])
        : claimerWallet.publicKey;
    transaction.recentBlockhash = (
      await connection.getRecentBlockhash("max")
    ).blockhash;
    approverAuthority && transaction.partialSign(approverAuthority);
    transaction.partialSign(mintKeypair);
    const copiedClaimTx = Transaction.from(
      transaction.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
      })
    );

    const responseRef = doc(collection(eventFirestore, "responses"));

    const auth = getAuth();
    const email = process.env.FIREBASE_ACCOUNT_EMAIL || "avinash@cardinal.so";
    const password = process.env.FIREBASE_ACCOUNT_PASSWORD || "Cardinal12345";
    await signInWithEmailAndPassword(auth, email, password);

    await setDoc(responseRef, {
      walletAddress: claimerWallet.publicKey.toString(),
      timestamp: Timestamp.fromDate(new Date()),
      ticketAmount: amount,
      formResponse: data.formResponse,
      eventId: checkEvent.docId,
      environment: checkEvent.environment,
      ticketId: data.ticketId,
      confirmed: false,
      claimType: "direct",
    });

    const claimSerialized = copiedClaimTx
      .serialize({
        verifySignatures: false,
        requireAllSignatures: false,
      })
      .toString("base64");
    serializedTransactions.push(claimSerialized);
    transactionDocumentIds.push(responseRef.id);
  }

  return {
    status: 200,
    transactions: serializedTransactions,
    transactionDocumentIds: transactionDocumentIds,
    message: `Built transaction to create ticket`,
  };
}
