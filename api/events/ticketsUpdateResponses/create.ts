import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { doc, writeBatch } from "firebase/firestore";

import type { UpdateResponseData } from "../firebase";
import { eventFirestore } from "../firebase";

export async function updateResponse(
  updateResponseData: UpdateResponseData
): Promise<{
  status: number;
  message: string;
  error?: string;
}> {
  const { transactionIds, transactionDocumentIds } = updateResponseData;

  if (transactionDocumentIds.length !== transactionIds.length) {
    throw "Transaction IDs and Document Ids do not match";
  }

  const auth = getAuth();
  const email = process.env.FIREBASE_ACCOUNT_EMAIL || "avinash@cardinal.so";
  const password = process.env.FIREBASE_ACCOUNT_PASSWORD || "Cardinal12345";
  await signInWithEmailAndPassword(auth, email, password);

  const batch = writeBatch(eventFirestore);

  for (let i = 0; i < transactionIds.length; i++) {
    const transactionId = transactionIds[0];
    const documentId = transactionDocumentIds[0];

    const responseRef = doc(eventFirestore, "responses", documentId);

    batch.update(responseRef, {
      transactionId: transactionId,
    });
  }

  await batch.commit();

  return {
    status: 200,
    message: `Successfully created event claim response`,
  };
}
