import { emptyWallet } from "@cardinal/common";
import {
  getNamespaceByName,
  withApproveClaimRequest,
} from "@cardinal/namespaces";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Timestamp } from "firebase/firestore";

import { withInitAndClaim } from "../../common/claimUtils";
import { connectionFor } from "../../common/connection";
import {
  PAYMENT_MINTS_DECIMALS_MAPPING,
  withHandlePayment,
} from "../../common/payments";
import { publicKeyFrom } from "../common";
import { getApproveAuthority } from "../constants";
import type { ClaimData, FirebaseResponse } from "../firebase";
import {
  authFirebase,
  getEvent,
  getPayerKeypair,
  getResponseRef,
  getTicket,
  getWriteBatch,
} from "../firebase";

export async function claim(data: ClaimData): Promise<{
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

  const firebaseBatch = getWriteBatch();
  const signerKeypair = Keypair.generate();
  const serializedTransactions: string[] = [];
  for (let i = 0; i < amount; i++) {
    const transaction = new Transaction();

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
        userWallet,
        new PublicKey(checkEvent.eventPaymentMint),
        amountToPay,
        mintDecimals
      );
    }

    // TODO 1 per wallet 1 per etc.
    const entryName = `${Math.random().toString(36).slice(6)}`;
    await withApproveClaimRequest(transaction, connection, payerWallet, {
      namespaceName: data.ticketId,
      entryName: entryName,
      user: userWallet.publicKey,
      approveAuthority: approverAuthority?.publicKey,
    });

    const mintKeypair = Keypair.generate();
    await withInitAndClaim(
      connection,
      userWallet,
      transaction,
      data.ticketId,
      entryName,
      mintKeypair,
      undefined,
      undefined,
      payerWallet.publicKey
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
    transaction.partialSign(mintKeypair);
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

    ////////////// UPDATE RESPONSES //////////////
    const responseRef = getResponseRef();
    firebaseBatch.set(responseRef, {
      eventId: checkEvent.docId,
      ticketId: data.ticketId,
      environment: checkEvent.environment,
      timestamp: Timestamp.fromDate(new Date()),
      payerAddress: userWallet.publicKey.toString(),
      claimerAddress: userWallet.publicKey.toString(),
      ticketAmount: 1,
      formResponse: data.formResponse,
      payerTransactionId: null,
      payerSignerPubkey: signerKeypair.publicKey.toString(),
      approvalData: { type: "direct", value: userWallet.publicKey.toString() },
      approvalTransactionId: null,
      approvalSignerPubkey: signerKeypair.publicKey.toString(),
      claimTransactionId: null,
      claimSignerPubkey: signerKeypair.publicKey.toString(),
    } as FirebaseResponse);

    const claimSerialized = copiedClaimTx
      .serialize({
        verifySignatures: false,
        requireAllSignatures: false,
      })
      .toString("base64");
    serializedTransactions.push(claimSerialized);
  }

  await firebaseBatch.commit();

  return {
    status: 200,
    transactions: serializedTransactions,
    message: `Built transaction to create ticket`,
  };
}
