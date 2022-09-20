import { tryPublicKey } from "@cardinal/common";
import {
  getNamespaceByName,
  withApproveClaimRequest,
} from "@cardinal/namespaces";
import { utils } from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
import type { ConfirmedSignatureInfo, PublicKey } from "@solana/web3.js";
import {
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";

import { connectionFor } from "../../common/connection";
import { claimUrl } from "../common";
import { getApproveAuthority } from "../constants";
import { approvalSuccessfulEmail, sendEmail } from "../email";
import type { FirebaseApproval, FirebaseResponse } from "./../firebase";
import {
  eventFirestore,
  getApprovalRef,
  getEvent,
  getTicket,
} from "./../firebase";

const confirmTransactionInfos: (
  | {
      id: "payerTransactionId";
      signerPubkey: "payerSignerPubkey";
    }
  | {
      id: "approvalTransactionId";
      signerPubkey: "approvalSignerPubkey";
    }
  | {
      id: "claimTransactionId";
      signerPubkey: "claimSignerPubkey";
    }
)[] = [
  { id: "payerTransactionId", signerPubkey: "payerSignerPubkey" },
  { id: "approvalTransactionId", signerPubkey: "approvalSignerPubkey" },
  { id: "claimTransactionId", signerPubkey: "claimSignerPubkey" },
];

export const EVENT_APPROVER_LAMPORTS = 2 * 10 ** 6;
export const RESPONSE_TRANSACTION_EXPIRATION_SECONDS = 120;

export const confirmTransactions = async () => {
  for (let i = 0; i < confirmTransactionInfos.length; i++) {
    const confirmTransactionInfo = confirmTransactionInfos[i]!;
    try {
      const responsesQuery = eventFirestore
        .collection("responses")
        .where(confirmTransactionInfo.id, "==", null)
        .where(confirmTransactionInfo.signerPubkey, "!=", null);
      const queryResults = (await responsesQuery.get()).docs;
      console.log(
        `> ${confirmTransactionInfo.id.toString()} (${queryResults.length})`
      );
      const currentTimestamp = Date.now();
      for (const doc of queryResults) {
        try {
          const response = doc.data() as FirebaseResponse;
          console.log(`> Response`, response);

          if (!response.timestamp) throw "Invalid timestamp";
          if (
            // Expired transaction signerPubkey
            (currentTimestamp - response.timestamp.toMillis()) / 1000 >
            RESPONSE_TRANSACTION_EXPIRATION_SECONDS
          ) {
            await doc.ref.update({
              [confirmTransactionInfo.signerPubkey]: null,
            });
          } else {
            // Look for valid transaction with signerPubkey
            const confirmedSignatureInfo = await findTransactionSignedByUser(
              response[confirmTransactionInfo.signerPubkey],
              response.environment
            );
            if (!confirmedSignatureInfo) throw "Transaction not found";
            await doc.ref.update({
              [confirmTransactionInfo.id]: confirmedSignatureInfo.signature,
            });
          }
        } catch (e) {
          console.log("[error] failed to confirm transaction response", e);
        }
      }
    } catch (e) {
      console.log("[error] failed to find transactions", e);
    }
  }

  //////////////////// approval transaction ////////////////////
  // get responses where payment has been confirmed and no approval is found
  const responsesQuery = eventFirestore
    .collection("responses")
    .where("payerTransactionId", "!=", null)
    .where("approvalTransactionId", "==", null)
    .where("approvalSignerPubkey", "==", null);
  const queryResults = (await responsesQuery.get()).docs;
  console.log("> Approvals", queryResults.length);

  for (const doc of queryResults) {
    try {
      // let keypair: Keypair | undefined;
      // let response: FirebaseResponse | undefined;
      await eventFirestore.runTransaction(async (transaction) => {
        const responseDoc = await transaction.get(doc.ref);
        const responseTx = responseDoc.data() as FirebaseResponse;
        if (!responseTx.approvalData) {
          throw "[error] response missing approval signer pubkey";
        }
        if (responseTx.approvalTransactionId) {
          throw "[error] response already being approved and notified";
        }
        const approvalRef = getApprovalRef(
          responseTx.approvalData.approvalSignerPubkey
        );
        const approvalDoc = await transaction.get(approvalRef);
        const approval = approvalDoc.data() as FirebaseApproval;
        if (!approval.secretKey) {
          throw "[error] approval missing secret key";
        }
        if (approval.approvalData) {
          throw "[error] response already been approved and notified";
        }
        const keypair = Keypair.fromSecretKey(
          utils.bytes.bs58.decode(approval.secretKey)
        );
        await notifyApproval(
          responseTx,
          keypair,
          responseTx.approvalData.entryName
        );
        transaction.update(responseDoc.ref, {
          approvalSignerPubkey: responseTx.approvalData.approvalSignerPubkey,
          approvalTransactionId: responseTx.payerTransactionId,
        });
        transaction.update(approvalRef, {
          approvalData: responseTx.approvalData,
        });
      });
    } catch (e) {
      console.log("[error] Failed to run send transaction", e);
    }
  }
};

const findTransactionSignedByUser = async (
  signerString: string | undefined | null,
  environment: string | null
): Promise<ConfirmedSignatureInfo | null> => {
  const signerPublicKey = tryPublicKey(signerString);
  if (!signerPublicKey) throw "Invalid signer public key uploaded to firebase";
  const connection = connectionFor(environment, "mainnet-beta", {
    commitment: "finalized",
  });
  const confirmedSignatureInfos = await connection.getSignaturesForAddress(
    signerPublicKey,
    undefined,
    "finalized"
  );
  for (const confirmedSignatureInfo of confirmedSignatureInfos) {
    const transaction = await connection.getTransaction(
      confirmedSignatureInfo.signature
    );
    const accountIndex = transaction?.transaction.message.accountKeys.findIndex(
      (a) => a.equals(signerPublicKey)
    );
    if (
      accountIndex &&
      transaction?.transaction.message.isAccountSigner(accountIndex)
    ) {
      return confirmedSignatureInfo;
    }
  }
  console.log(`> Failed to find transaction for ${signerString ?? ""}`);
  return null;
};

const _sendApproveTransaction = async (
  response: FirebaseResponse,
  keypair: Keypair,
  environment: string | null
): Promise<{
  txid: string;
  keypair: Keypair;
  approveAuthority: PublicKey;
  entryName: string;
}> => {
  const ticketId = response.ticketId;
  if (!ticketId) throw "[error] Response missing ticketId";
  if (!response.payerTransactionId)
    throw "[error] Response missing payer transaction";
  const connection = connectionFor(environment ?? null);
  const checkNamespace = await getNamespaceByName(connection, ticketId);
  const approveAuthority = getApproveAuthority(
    checkNamespace.parsed.approveAuthority
  );
  const transaction = new Transaction();

  // TODO 1 per wallet 1 per etc.
  // user payer transaction ID this will overwrite existing claim request so only most recent is valid
  // const entryName = `${Math.random().toString(36).slice(2)}`;
  const entryName = response.payerTransactionId?.slice(0, 32);
  await withApproveClaimRequest(
    transaction,
    connection,
    new SignerWallet(approveAuthority),
    {
      namespaceName: ticketId,
      entryName: entryName,
      user: keypair.publicKey,
      approveAuthority: approveAuthority?.publicKey,
    }
  );

  console.log(
    `> ...executing approve claim request transaction for ${transaction.instructions.length} tickets`
  );
  transaction.feePayer = approveAuthority.publicKey;
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;
  const txid = await sendAndConfirmTransaction(connection, transaction, [
    approveAuthority,
  ]);
  console.log(`> Successfully executed transaction ${txid}`);
  return {
    txid,
    keypair,
    approveAuthority: approveAuthority.publicKey,
    entryName,
  };
};

const notifyApproval = async (
  response: FirebaseResponse,
  claimKey: Keypair,
  entryName: string
) => {
  const event = await getEvent(response.eventId);
  const ticket = await getTicket(response.ticketId);
  const claimLink = claimUrl({
    eventShortLink: event.shortLink,
    config: event.config,
    keypair: claimKey,
    entryName: entryName,
    ticketId: ticket.docId,
    environment: event.environment,
  });
  if (response.approvalData?.type === "email") {
    await sendEmail(
      response.approvalData.value,
      approvalSuccessfulEmail(
        event,
        ticket.ticketName,
        ticket.docId,
        claimLink,
        event.config
      )
    );
    return;
  }
  throw "[error] Unknown approval type";
};
