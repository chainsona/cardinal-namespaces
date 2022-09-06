import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { setDoc, Timestamp } from "firebase/firestore";

import type { ClaimResponseData } from "../firebase";
import { getEventClaimResponseRef } from "../firebase";

export async function createEventClaimResponse(
  claimResponseData: ClaimResponseData
): Promise<{
  status: number;
  message: string;
  error?: string;
}> {
  const responseRef = getEventClaimResponseRef(claimResponseData.eventId);

  const auth = getAuth();
  const email = process.env.FIREBASE_ACCOUNT_EMAIL || "";
  const password = process.env.FIREBASE_ACCOUNT_PASSWORD || "";
  await signInWithEmailAndPassword(auth, email, password);

  await setDoc(responseRef, {
    walletAddress: claimResponseData.account,
    timestamp: Timestamp.fromDate(new Date()),
    ticketAmount: claimResponseData.amount,
    formResponse: claimResponseData.formResponse ?? [],
  });

  return {
    status: 200,
    message: `Successfully created event claim response`,
  };
}
