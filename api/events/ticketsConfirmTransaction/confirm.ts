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
  deleteDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { connectionFor } from "../../common/connection";
import { claimUrl } from "../common";
import { eventApproverKeys } from "../constants";
import { approvalSuccessfulEmail, sendEmail } from "../email";
import { FirebaseEvent, FirebaseResponse, getTicket } from "./../firebase";
import { authFirebase, eventFirestore, getEvent } from "./../firebase";

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

export const confirmTransactions = async () => {
  await authFirebase();

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
      const currentTimestamp = Date.now();
      for (const doc of queryResults.docs) {
        const response = doc.data() as FirebaseResponse;
        console.log(`response, info`, response, confirmTransactionInfo);

        if (!response.timestamp) throw "Invalid timestamp";
        if ((currentTimestamp - response.timestamp.toMillis()) / 1000 > 120) {
          await deleteDoc(doc.ref);
          continue;
        }
        const confirmedSignatureInfo = await findTransactionSignedByUser(
          response[confirmTransactionInfo.signerPubkey],
          response.environment
        );
        if (!confirmedSignatureInfo) throw "Transaction not found";
        await updateDoc(doc.ref, {
          [confirmTransactionInfo.id]: confirmedSignatureInfo.signature,
        });
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

  for (const doc of queryResults.docs) {
    const response = doc.data() as FirebaseResponse;
    const [txid, keypair, approverPublicKey] = await sendApproveTransaction(
      response,
      response.environment
    );
    await notifyApproval(response, [keypair]);
    await updateDoc(doc.ref, {
      approvalTransactionId: txid,
      approvalSignerPubkey: approverPublicKey.toString(),
    });
  }
};

const findTransactionSignedByUser = async (
  signerString: string | undefined | null,
  environment: string | null
): Promise<ConfirmedSignatureInfo | null> => {
  const signerPublicKey = tryPublicKey(signerString);
  if (!signerPublicKey) throw "Invalid signer public key uploaded to firebase";
  const connection = connectionFor(environment);
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
  return null;
};

const sendApproveTransaction = async (
  response: FirebaseResponse,
  environment: string | null
): Promise<[string, Keypair, PublicKey]> => {
  const ticketId = response.ticketId;
  if (!ticketId) throw "Response missing ticketId";
  const connection = connectionFor(environment ?? null);
  const checkNamespace = await getNamespaceByName(connection, ticketId);
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
  if (!approverAuthority) throw "No approve authority found";

  const transaction = new Transaction();

  // TODO 1 per wallet 1 per etc.
  const entryName = `${Math.random().toString(36).slice(2)}`;
  const keypair = new Keypair();
  await withApproveClaimRequest(
    transaction,
    connection,
    new SignerWallet(approverAuthority),
    {
      namespaceName: ticketId,
      entryName: entryName,
      user: keypair.publicKey,
      approveAuthority: approverAuthority?.publicKey,
    }
  );

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
  return [txid, keypair, approverAuthority.publicKey];
};

const notifyApproval = async (response: FirebaseResponse, claimKeys) => {
  const event = await getEvent(response.eventId);
  const ticket = await getTicket(response.ticketId);

  if (response.approvalData?.type === "email") {
    await sendEmail(
      response.approvalData.value,
      // TODO store companyconfig in event
      approvalSuccessfulEmail(event, ticket.ticketName, [], "default")
    );
  }
  throw "Unknown approval type";
};
