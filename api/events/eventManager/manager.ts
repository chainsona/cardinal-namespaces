import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import type { DocumentData, DocumentReference } from "firebase/firestore";
import { setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadString } from "firebase/storage";

import { WRAPPED_SOL_ADDRESS } from "../../common/payments";
import type { EventData } from "../firebase";
import {
  eventStorage,
  getEventRef,
  tryGetEventFromShortlink,
} from "../firebase";

export async function createOrUpdate(eventData: EventData): Promise<{
  status: number;
  message: string;
  error?: string;
}> {
  const checkEvent = await tryGetEventFromShortlink(eventData.shortLink);
  if (!!checkEvent && checkEvent.creatorId !== eventData.creatorId) {
    throw "Either event short link is not unique or invalid event authority";
  }

  if (!eventData.eventBannerImage && !checkEvent) {
    throw "Need a banner image for event creation";
  }

  const auth = getAuth();
  const email = process.env.FIREBASE_ACCOUNT_EMAIL || "";
  const password = process.env.FIREBASE_ACCOUNT_PASSWORD || "";
  await signInWithEmailAndPassword(auth, email, password);

  let eventRef: DocumentReference<DocumentData> | undefined;
  if (!checkEvent) {
    eventRef = getEventRef();
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
    });
  } else {
    eventRef = getEventRef(checkEvent.docId);
    await updateDoc(eventRef, {
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
    });
  }

  if (eventData.eventBannerImage && eventData.eventBannerImage.length !== 0) {
    const eventImageRef = ref(eventStorage, `banners/${eventRef.id}.png`);
    await uploadString(eventImageRef, eventData.eventBannerImage, "data_url");
  }
  return {
    status: 200,
    message: `Successfully created event`,
  };
}
