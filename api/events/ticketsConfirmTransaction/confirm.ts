import { tryPublicKey } from "@cardinal/common";
import {
  getNamespaceByName,
  withApproveClaimRequest,
} from "@cardinal/namespaces";
import { SignerWallet } from "@saberhq/solana-contrib";
import type { ConfirmedSignatureInfo, PublicKey } from "@solana/web3.js";
import {
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import {
  collection,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { connectionFor } from "../../common/connection";
import { claimUrl } from "../common";
import { getApproveAuthority } from "../constants";
import { approvalSuccessfulEmail, sendEmail } from "../email";
import type { FirebaseResponse } from "./../firebase";
import {
  authFirebase,
  eventFirestore,
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
      const queryResults = await getDocs(
        query(
          collection(eventFirestore, "responses"),
          where(confirmTransactionInfo.id, "==", null),
          where(confirmTransactionInfo.signerPubkey, "!=", null)
        )
      );
      console.log(confirmTransactionInfo, queryResults.docs.length);
      const currentTimestamp = Date.now();
      for (const doc of queryResults.docs) {
        const response = doc.data() as FirebaseResponse;
        console.log(`response, info`, response, confirmTransactionInfo);

        if (!response.timestamp) throw "Invalid timestamp";
        if (
          // Expired transaction signerPubkey
          (currentTimestamp - response.timestamp.toMillis()) / 1000 >
          RESPONSE_TRANSACTION_EXPIRATION_SECONDS
        ) {
          await authFirebase();
          await updateDoc(doc.ref, {
            [confirmTransactionInfo.signerPubkey]: null,
          });
        } else {
          // Look for valid transaction with signerPubkey
          const confirmedSignatureInfo = await findTransactionSignedByUser(
            response[confirmTransactionInfo.signerPubkey],
            response.environment
          );
          if (!confirmedSignatureInfo) throw "Transaction not found";
          await authFirebase();
          await updateDoc(doc.ref, {
            [confirmTransactionInfo.id]: confirmedSignatureInfo.signature,
          });
        }
      }
    } catch (e) {
      console.log("Failed to confirm transaction responses in Firebase: ", e);
    }
  }

  //////////////////// approval transaction ////////////////////
  // get responses where payment has been confirmed and no approval is found
  const queryResults = await getDocs(
    query(
      collection(eventFirestore, "responses"),
      where("payerTransactionId", "!=", null),
      where("approvalTransactionId", "==", null),
      where("approvalSignerPubkey", "==", null)
    )
  );
  console.log("Approvals", queryResults.docs.length);

  for (const doc of queryResults.docs) {
    const response = doc.data() as FirebaseResponse;
    await authFirebase();
    const { txid, keypair, approveAuthority, entryName } =
      await sendApproveTransaction(response, response.environment);
    await notifyApproval(response, keypair, entryName);
    await updateDoc(doc.ref, {
      approvalTransactionId: txid,
      approvalSignerPubkey: approveAuthority.toString(),
    });
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
    if (
      transaction?.transaction.signatures.includes(signerPublicKey.toString())
    ) {
      return confirmedSignatureInfo;
    }
  }
  console.log(`Failed to find transaction for ${signerString ?? ""}`);
  return null;
};

const sendApproveTransaction = async (
  response: FirebaseResponse,
  environment: string | null
): Promise<{
  txid: string;
  keypair: Keypair;
  approveAuthority: PublicKey;
  entryName: string;
}> => {
  const ticketId = response.ticketId;
  if (!ticketId) throw "Response missing ticketId";
  const connection = connectionFor(environment ?? null);
  const checkNamespace = await getNamespaceByName(connection, ticketId);
  const approveAuthority = getApproveAuthority(
    checkNamespace.parsed.approveAuthority
  );
  const transaction = new Transaction();

  // TODO 1 per wallet 1 per etc.
  const entryName = `${Math.random().toString(36).slice(2)}`;
  const keypair = new Keypair();
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
    `Executing approve claim request transaction for ${transaction.instructions.length} tickets`
  );
  transaction.feePayer = approveAuthority.publicKey;
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;
  const txid = await sendAndConfirmTransaction(connection, transaction, [
    approveAuthority,
  ]);
  console.log(`Successfully executed transaction ${txid}`);
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
    ticketId: ticket.ticketId,
    environment: event.environment,
  });
  if (response.approvalData?.type === "email") {
    await sendEmail(
      response.approvalData.value,
      approvalSuccessfulEmail(
        event,
        ticket.ticketName,
        [claimLink],
        event.config
      )
    );
  }
  throw "Unknown approval type";
};
