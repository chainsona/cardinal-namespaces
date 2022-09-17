import { updateDoc } from "firebase/firestore";
import { ref, uploadString } from "firebase/storage";

import { WRAPPED_SOL_ADDRESS } from "../../common/payments";
import type { EventData, FirebaseEvent } from "../firebase";
import {
  authFirebase,
  eventStorage,
  getEventRef,
  tryGetEvent,
} from "../firebase";

export async function updateEvent(
  eventId: string,
  eventData: EventData
): Promise<{
  status: number;
  message: string;
  error?: string;
}> {
  const checkEvent = await tryGetEvent(eventId);
  if (!checkEvent) {
    throw "Event ID does not exist";
  }

  if (checkEvent.creatorId !== eventData.creatorId) {
    throw "Either event short link is not unique or invalid event authority";
  }

  if (!eventData.eventBannerImage && !checkEvent) {
    throw "Need a banner image for event creation";
  }

  await authFirebase();
  const eventRef = getEventRef(checkEvent.docId);
  await updateDoc(eventRef, {
    docId: eventRef.id,
    shortLink: eventData.shortLink,
    config: eventData.config,
    eventName: eventData.eventName,
    eventLocation: eventData.eventLocation,
    eventDescription: eventData.eventDescription,
    eventStartTime: eventData.eventStartTime,
    eventEndTime: eventData.eventEndTime,
    creatorId: eventData.creatorId,
    environment: eventData.environment,
    eventPaymentMint: WRAPPED_SOL_ADDRESS,
    eventQuestions: eventData.eventQuestions ?? [],
    eventBannerImage: null,
  } as FirebaseEvent);

  if (eventData.eventBannerImage && eventData.eventBannerImage.length !== 0) {
    const eventImageRef = ref(eventStorage, `banners/${eventRef.id}.png`);
    await uploadString(eventImageRef, eventData.eventBannerImage, "data_url");
  }
  return {
    status: 200,
    message: `Successfully created event`,
  };
}
