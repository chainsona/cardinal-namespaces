import { WRAPPED_SOL_ADDRESS } from "../../common/payments";
import type { EventData, FirebaseEvent } from "../firebase";
import {
  eventStorage,
  formatUpload,
  getEventRef,
  tryGetEventFromShortlink,
} from "../firebase";

export async function createEvent(eventData: EventData): Promise<{
  status: number;
  message: string;
  error?: string;
}> {
  const checkEvent = await tryGetEventFromShortlink(eventData.shortLink);
  if (checkEvent) throw "Event short link already taken";

  const eventRef = getEventRef();
  await eventRef.set({
    docId: eventRef.id,
    shortLink: eventData.shortLink,
    config: eventData.config ?? null,
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
    const contents = formatUpload(eventData.eventBannerImage);
    const imageFile = eventStorage.bucket().file(`banners/${eventRef.id}.png`);
    await imageFile
      .save(contents, {
        gzip: true,
        contentType: "image/png",
      })
      .then(() => {
        console.log("uploaded ticket metadata");
      });
  }
  return {
    status: 200,
    message: `Successfully created event`,
  };
}
