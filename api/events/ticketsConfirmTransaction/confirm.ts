import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import type { Timestamp } from "firebase/firestore";
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

    for (const doc of querySnapshot.docs) {
      const { transactionId, environment, updateSignerPublicKey } =
        doc.data() as {
          transactionId: string;
          environment: string;
          updateSignerPublicKey: string;
          timestamp: Timestamp;
        };
      const connection = connectionFor(environment);
      const signatureStatus = await connection.getSignatureStatus(
        transactionId
      );
      const transaction = await connection.getTransaction(transactionId);
      if (
        signatureStatus.value?.confirmationStatus === "confirmed" &&
        transaction?.transaction.signatures.includes(updateSignerPublicKey)
      ) {
        await updateDoc(doc.ref, {
          confirmed: true,
        });
      }
    }
  } catch (e) {
    console.log("Failed to confirm transaction responses in Firebase: ", e);
  }
};
