import { tryPublicKey } from "@cardinal/common";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import type { Timestamp } from "firebase/firestore";
import {
  collection,
  deleteDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { connectionFor } from "../../common/connection";
import { authFirebase, eventFirestore } from "./../firebase";

const confirmTransactionInfos = [
  { id: "payerTransactionId", signerPubkey: "payerSignerPubkey" },
  { id: "approvalTransactionId", signerPubkey: "approvalSignerPubkey" },
  { id: "claimTransactionId", signerPubkey: "claimSignerPubkey" },
];

export const confirmTransactions = async () => {
  await authFirebase();

  for (let i = 0; i < confirmTransactionInfos.length; i++) {
    const confirmTransactionInfo = confirmTransactionInfos[i]!;
    try {
      const querySnapshot = await getDocs(
        query(
          collection(eventFirestore, "responses"),
          where(confirmTransactionInfo.id, "==", null),
          where(confirmTransactionInfo.signerPubkey, "!=", null)
        )
      );
      const currentTimestamp = Date.now();
      for (const doc of querySnapshot.docs) {
        const { environment, signerPublicKey, timestamp } = doc.data() as {
          environment: string;
          signerPublicKey: string;
          timestamp: Timestamp;
        };
        const signer = tryPublicKey(signerPublicKey);
        if (!signer) {
          throw "Invalid signer public key uploaded to firebase";
        }
        if ((currentTimestamp - timestamp.toMillis()) / 1000 > 120) {
          await deleteDoc(doc.ref);
          continue;
        }
        const connection = connectionFor(environment);
        const signatures = await connection.getSignaturesForAddress(
          signer,
          undefined,
          "finalized"
        );
        for (const signature of signatures) {
          const transaction = await connection.getTransaction(
            signature.signature
          );
          if (transaction?.transaction.signatures.includes(signerPublicKey)) {
            await updateDoc(doc.ref, {
              confirmed: true,
            });
            break;
          }
        }
      }
    } catch (e) {
      console.log("Failed to confirm transaction responses in Firebase: ", e);
    }
  }
};
