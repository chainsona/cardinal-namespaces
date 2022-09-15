import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
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
      const data = doc.data() as { transactionId: string; environment: string };
      const { transactionId, environment } = data;
      const connection = connectionFor(environment);
      const signatureStatus = await connection.getSignatureStatus(
        transactionId
      );
      if (signatureStatus.value?.confirmationStatus === "confirmed") {
        await updateDoc(doc.ref, {
          confirmed: true,
        });
      }
    }
  } catch (e) {
    console.log("Failed to confirm transaction responses in Firebase: ", e);
  }
};
