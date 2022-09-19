import { emptyWallet } from "@cardinal/common";
import {
  getNamespaceByName,
  withApproveClaimRequest,
} from "@cardinal/namespaces";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { collection, doc, Timestamp, writeBatch } from "firebase/firestore";

import { connectionFor } from "../../common/connection";
import {
  PAYMENT_MINTS_DECIMALS_MAPPING,
  withHandlePayment,
} from "../../common/payments";
import { publicKeyFrom } from "../common";
import { getApproveAuthority } from "../constants";
import type {
  ApproveData,
  FirebaseApproval,
  FirebaseResponse,
} from "../firebase";
import {
  authFirebase,
  eventFirestore,
  getApprovalRef,
  getEvent,
  getPayerKeypair,
  getTicket,
} from "../firebase";

export async function approve(data: ApproveData): Promise<{
  status: number;
  transactions?: string[];
  message?: string;
  error?: string;
}> {
  // 0. setup firebase
  await authFirebase();
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
    // TODO 1 per wallet 1 per etc.
    const approvalSigner = Keypair.generate();
    const entryName = `${Math.random().toString(36).slice(6)}`;
    await withApproveClaimRequest(transaction, connection, payerWallet, {
      namespaceName: data.ticketId,
      entryName: entryName,
      user: approvalSigner.publicKey,
      approveAuthority: approverAuthority?.publicKey,
    });

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
          {
            pubkey: signerKeypair.publicKey,
            isSigner: true,
            isWritable: false,
          },
          {
            pubkey: userPublicKey,
            isSigner: true,
            isWritable: false,
          },
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
      approvalData: {
        type: "email",
        value: data.email,
        entryName,
        approvalSignerPubkey: approvalSigner.publicKey.toString(),
      },
      approvalTransactionId: null,
      approvalSignerPubkey: null,
      claimTransactionId: null,
      claimSignerPubkey: null,
    } as FirebaseResponse);

    const approvalRef = getApprovalRef(approvalSigner.publicKey.toString());
    firebaseBatch.set(approvalRef, {
      responseId: responseRef.id,
      secretKey: approvalSigner.secretKey.toString(),
      approvalData: null,
    } as FirebaseApproval);
  }

  await firebaseBatch.commit();

  return {
    status: 200,
    transactions: serializedTransactions,
    message: `Built transaction to pay for tickets`,
  };
}
