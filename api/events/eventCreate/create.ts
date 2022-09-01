import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { setDoc } from "firebase/firestore";
import { ref, uploadString } from "firebase/storage";

import { WRAPPED_SOL_ADDRESS } from "../../common/payments";
import type { EventData } from "../firebase";
import {
  eventStorage,
  getEventRef,
  tryGetEventFromShortlink,
} from "../firebase";

export async function createEvent(eventData: EventData): Promise<{
  status: number;
  message: string;
  error?: string;
}> {
  const checkEvent = await tryGetEventFromShortlink(eventData.shortLink);
  if (checkEvent) {
    throw "Event short link already taken";
  }

  const auth = getAuth();
  const email = process.env.FIREBASE_ACCOUNT_EMAIL || "";
  const password = process.env.FIREBASE_ACCOUNT_PASSWORD || "";
  await signInWithEmailAndPassword(auth, email, password);

  const eventRef = getEventRef();
  await setDoc(eventRef, {
    docId: eventRef.id,
    shortLink: eventData.shortLink,
    eventName: eventData.eventName,
    eventLocation: eventData.eventLocation,
    eventDescription: eventData.eventDescription,
    eventStartTime: eventData.eventStartTime,
    eventEndTime: eventData.eventEndTime,
    creatorId: eventData.creatorId,
    environment: eventData.environment,
    eventPaymentMint: WRAPPED_SOL_ADDRESS,
    eventQuestions: eventData.eventQuestions,
  });
  if (eventData.eventBannerImage && eventData.eventBannerImage.length !== 0) {
    const eventImageRef = ref(eventStorage, `banners/${eventRef.id}.png`);
    await uploadString(eventImageRef, eventData.eventBannerImage, "data_url");
  }
  return {
    status: 200,
    message: `Successfully created event`,
  };
}
