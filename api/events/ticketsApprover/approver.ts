import { emptyWallet, tryGetAccount, tryPublicKey } from "@cardinal/common";
import { getNamespaceByName } from "@cardinal/namespaces";
import { utils } from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
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
import { eventApproverKeys } from "../constants";
import type { ApproveData, FirebaseResponse } from "../firebase";
import {
  authFirebase,
  eventFirestore,
  getEvent,
  tryGetEventTicket,
  tryGetPayer,
} from "../firebase";
import { EVENT_APPROVER_LAMPORTS } from "../ticketsConfirmTransaction/confirm";

export async function approve(data: ApproveData): Promise<{
  status: number;
  transactions?: string[];
  message?: string;
  error?: string;
}> {
  // 1. check ticket
  const checkTicket = await tryGetEventTicket(data.ticketId);
  if (!checkTicket) {
    return {
      status: 400,
      message: JSON.stringify({ message: "Ticket not found" }),
    };
  }
  // 2. check event
  const checkEvent = await getEvent(checkTicket.eventId);
  // 3. check namespaces
  const connection = connectionFor(checkEvent.environment);
  const checkNamespace = await tryGetAccount(() =>
    getNamespaceByName(connection, data.ticketId)
  );
  if (!checkNamespace?.parsed) {
    return {
      status: 400,
      message: `No ticket namespace found`,
    };
  }
  // 4. Get approver
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
  // 5. Get claimer
  const userPublicKey = tryPublicKey(data.account);
  if (!userPublicKey) {
    return {
      status: 400,
      message: `Invalid claimer pubkey`,
    };
  }
  const userWallet = emptyWallet(userPublicKey);
  // 6. Get fee payer
  let payerWallet = userWallet;
  if (checkTicket.feePayer) {
    const payer = await tryGetPayer(checkTicket.feePayer);
    if (!payer?.secretKey) throw "Missing secret key";
    payerWallet = new SignerWallet(
      Keypair.fromSecretKey(utils.bytes.bs58.decode(payer?.secretKey))
    );
  }

  const amount = Number(data.amount);
  if (isNaN(amount)) {
    throw "Invalid supply provided";
  }

  // 7. setup firebase
  const firebaseBatch = writeBatch(eventFirestore);
  await authFirebase();

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
