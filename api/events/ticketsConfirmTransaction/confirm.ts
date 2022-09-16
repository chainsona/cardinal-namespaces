import { tryPublicKey } from "@cardinal/common";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { deleteDoc, Timestamp } from "firebase/firestore";
import {
  collection,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { connectionFor } from "../../common/connection";
import { eventFirestore } from "./../firebase";

export const confirmTransactions = async () => {
  try {
    const auth = getAuth();
    const email = process.env.FIREBASE_ACCOUNT_EMAIL || "";
    const password = process.env.FIREBASE_ACCOUNT_PASSWORD || "";
    await signInWithEmailAndPassword(auth, email, password);

    const q = query(
      collection(eventFirestore, "responses"),
      where("confirmed", "==", false)
    );
    const querySnapshot = await getDocs(q);
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
};
