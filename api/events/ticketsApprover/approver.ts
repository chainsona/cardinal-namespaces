import { emptyWallet } from "@cardinal/common";
import { getNamespaceByName } from "@cardinal/namespaces";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { collection, doc, Timestamp, writeBatch } from "firebase/firestore";

import { connectionFor } from "../../common/connection";
import {
  PAYMENT_MINTS_DECIMALS_MAPPING,
  withHandlePayment,
} from "../../common/payments";
import { publicKeyFrom } from "../common";
import { getApproveAuthority } from "../constants";
import type { ApproveData, FirebaseResponse } from "../firebase";
import {
  authFirebase,
  eventFirestore,
  getEvent,
  getPayerKeypair,
  getTicket,
} from "../firebase";
import { EVENT_APPROVER_LAMPORTS } from "../ticketsConfirmTransaction/confirm";

export async function approve(data: ApproveData): Promise<{
  status: number;
  transactions?: string[];
  message?: string;
  error?: string;
}> {
  // 1. get ticket
  const checkTicket = await getTicket(data.ticketId);
  // 2. get event
  const checkEvent = await getEvent(checkTicket.eventId);
  // 3. get namespace
  const connection = connectionFor(checkEvent.environment);
  const checkNamespace = await getNamespaceByName(connection, data.ticketId);
  // 4. get approver
  const approverAuthority = getApproveAuthority(
    checkNamespace.parsed.approveAuthority
  );
  // 5. get user
  const userPublicKey = publicKeyFrom(data.account, "Invalid user publicKey");
  const userWallet = emptyWallet(userPublicKey);
  // 6. get payer
  let payerWallet = userWallet;
  if (checkTicket.feePayer) {
    payerWallet = await getPayerKeypair(checkTicket.feePayer);
  }
  // 7. check amount
  const amount = Number(data.amount);
  if (isNaN(amount)) throw "Invalid supply provided";
  // 8. setup firebase
  await authFirebase();
  const firebaseBatch = writeBatch(eventFirestore);

  const signerKeypair = Keypair.generate();
  const serializedTransactions: string[] = [];
  for (let i = 0; i < amount; i++) {
    const transaction = new Transaction();
    const ticketPrice = Number(checkTicket.ticketPrice);
    if (checkEvent.eventPaymentMint && ticketPrice > 0) {
      const paymentMint = new PublicKey(checkEvent.eventPaymentMint);
      if (!(paymentMint.toString() in PAYMENT_MINTS_DECIMALS_MAPPING)) {
        throw "Missing event payment mint decimals";
      }
      const mintDecimals =
        PAYMENT_MINTS_DECIMALS_MAPPING[paymentMint.toString()];
      const amountToPay = ticketPrice * 10 ** mintDecimals;
      await withHandlePayment(
        transaction,
        connection,
        new PublicKey(checkEvent.creatorId),
        userWallet,
        new PublicKey(checkEvent.eventPaymentMint),
        amountToPay,
        mintDecimals
      );
    }

    // Enough to pay for email
    transaction.instructions.push(
      SystemProgram.transfer({
        fromPubkey: payerWallet.publicKey,
        toPubkey: approverAuthority.publicKey,
        lamports: EVENT_APPROVER_LAMPORTS,
      })
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
          ...[
            {
              pubkey: signerKeypair.publicKey,
              isSigner: true,
              isWritable: false,
            },
          ],
        ],
      },
      ...transaction.instructions.slice(1),
    ];

    transaction.feePayer = payerWallet.publicKey;
    transaction.recentBlockhash = (
      await connection.getRecentBlockhash("max")
    ).blockhash;
    approverAuthority && transaction.partialSign(approverAuthority);
    transaction.partialSign(signerKeypair);
    if (!payerWallet.publicKey.equals(userWallet.publicKey)) {
      await payerWallet.signTransaction(transaction);
    }
    const copiedClaimTx = Transaction.from(
      transaction.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
      })
    );
    const claimSerialized = copiedClaimTx
      .serialize({
        verifySignatures: false,
        requireAllSignatures: false,
      })
      .toString("base64");
    serializedTransactions.push(claimSerialized);

    ////////////// UPDATE RESPONSES //////////////
    const responseRef = doc(collection(eventFirestore, "responses"));
    firebaseBatch.set(responseRef, {
      eventId: checkEvent.docId,
      ticketId: data.ticketId,
      timestamp: Timestamp.fromDate(new Date()),
      environment: checkEvent.environment,
      payerAddress: payerWallet.publicKey.toString(),
      claimerAddress: null,
      ticketAmount: 1,
      formResponse: null,
      payerTransactionId: null,
      payerSignerPubkey: signerKeypair.publicKey.toString(),
      approvalData: { type: "email", value: data.email },
      approvalTransactionId: null,
      approvalSignerPubkey: null,
      claimTransactionId: null,
      claimSignerPubkey: null,
    } as FirebaseResponse);
  }

  await firebaseBatch.commit();

  return {
    status: 200,
    transactions: serializedTransactions,
    message: `Built transactino to pay for ticket`,
  };
}
