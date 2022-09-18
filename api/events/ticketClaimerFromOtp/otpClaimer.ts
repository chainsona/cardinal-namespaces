import { emptyWallet, tryPublicKey } from "@cardinal/common";
import { withClaimToken } from "@cardinal/token-manager";
import { utils } from "@project-serum/anchor";
import { Keypair, Transaction } from "@solana/web3.js";
import { Timestamp } from "firebase-admin/firestore";

import { withInitAndClaim } from "../../common/claimUtils";
import { connectionFor } from "../../common/connection";
import { publicKeyFrom } from "../common";
import type { FirebaseResponse, OtpClaimData } from "../firebase";
import {
  authFirebase,
  getEvent,
  getPayerKeypair,
  getResponseRef,
  getTicket,
  tryGetResponsesByApproval,
} from "../firebase";

export async function otpClaim(data: OtpClaimData): Promise<{
  status: number;
  transaction?: string;
  message?: string;
  error?: string;
}> {
  // 1. get ticket
  const checkTicket = await getTicket(data.ticketId);
  // 2. get event
  const checkEvent = await getEvent(checkTicket.eventId);
  // 3. get connection
  const connection = connectionFor(checkEvent.environment);
  // 4. get user
  const userPublicKey = publicKeyFrom(data.account, "Invalid claimer");
  const userWallet = emptyWallet(userPublicKey);
  // 5. get payer
  await authFirebase();
  let payerWallet = userWallet;
  if (checkTicket.feePayer) {
    payerWallet = await getPayerKeypair(checkTicket.feePayer);
  }

  let approvalSignerKeypair: Keypair;
  try {
    approvalSignerKeypair = Keypair.fromSecretKey(
      utils.bytes.bs58.decode(data.otp)
    );
  } catch (e) {
    throw `Invalid otp secret key`;
  }
  const transaction = new Transaction();

  const signerKeypair = Keypair.generate();
  const tokenManagerId = tryPublicKey(data.tokenManagerId);
  let mintKeypair: Keypair | undefined = undefined;
  if (tokenManagerId) {
    await withClaimToken(transaction, connection, userWallet, tokenManagerId, {
      otpKeypair: approvalSignerKeypair,
      payer: payerWallet.publicKey,
    });
  } else {
    mintKeypair = Keypair.generate();
    if (!data.entryName) throw "Missing entry name";
    await withInitAndClaim(
      connection,
      userWallet,
      transaction,
      data.ticketId,
      data.entryName,
      mintKeypair,
      0,
      approvalSignerKeypair.publicKey,
      payerWallet.publicKey
    );
  }

  const firstInstruction = transaction.instructions[0];
  transaction.instructions = [
    {
      ...firstInstruction,
      keys: [
        ...firstInstruction.keys,
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
  mintKeypair && transaction.partialSign(mintKeypair);
  transaction.partialSign(signerKeypair);
  transaction.partialSign(approvalSignerKeypair);
  if (!payerWallet.publicKey.equals(userWallet.publicKey)) {
    await payerWallet.signTransaction(transaction);
  }
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

  ////////////// UPDATE RESPONSES //////////////
  const queryResults = await tryGetResponsesByApproval(
    approvalSignerKeypair.publicKey.toString()
  );
  if (queryResults.length > 0) {
    const response = queryResults[0];
    await response.ref.update({
      claimerAddress: userWallet.publicKey.toString(),
      claimTransactionId: null,
      claimSignerPubkey: signerKeypair.publicKey.toString(),
    } as FirebaseResponse);
  } else {
    const responseRef = getResponseRef();
    await responseRef.set({
      eventId: checkEvent.docId,
      ticketId: data.ticketId,
      timestamp: Timestamp.fromDate(new Date()),
      environment: checkEvent.environment,
      payerAddress: payerWallet.publicKey.toString(),
      claimerAddress: userWallet.publicKey.toString(),
      ticketAmount: 1,
      formResponse: null,
      payerTransactionId: null,
      payerSignerPubkey: signerKeypair.publicKey.toString(),
      approvalData: null,
      approvalTransactionId: null,
      approvalSignerPubkey: null,
      claimTransactionId: null,
      claimSignerPubkey: signerKeypair.publicKey.toString(),
    } as FirebaseResponse);
  }

  return {
    status: 200,
    transaction: serialized,
    message: `Built transaction to claim ticket`,
  };
}
