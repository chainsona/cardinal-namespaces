import { SES } from "aws-sdk";
import type { SendEmailRequest } from "aws-sdk/clients/ses";

import { eventUrl } from "./common";
import type { FirebaseEvent } from "./firebase";
import { getEventBannerImage } from "./firebase";

export const approvalSuccessfulEmail = (
  event: FirebaseEvent,
  ticketName: string,
  ticketId: string,
  claimURL: string,
  config: string | null
) => `

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700&display=swap" rel="stylesheet">

<div style="display:flex; justify-content: center; color: black; font-family:Inter;">
  <div style="width:786px; border-radius: 20px; padding-top:40px; ">
    <img src="https://i.imgur.com/KwG2EA9.png" width="180px" style="margin-top: 20px; margin-bottom: 20px;" />
    <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-radius: 20px;">
      <img
        src=${`https://firebasestorage.googleapis.com/v0/b/cardinal-events.appspot.com/o/tickets%2F${ticketId}%2Fimage.png?alt=media`}
        alt="event-image" style="width: 200px; display: block; margin: auto; border-radius: 3%">
      <h2 style="margin: 0px;">${event.eventName}</h2>

      <h3> You've got your <u>${ticketName} ticket</u>! </h3>
      <div style="display: flex; justify-content: center; margin-bottom: 20px;">
        <a
        target="_blank"
        rel="noreferer"
        href=${`https://phantom.app/ul/browse/${encodeURIComponent(claimURL)}`}
          style="padding: 14px 18px; color: white; background-color: #72224c; border-radius: 5px; display: block; font-size: 16px;">Claim
          on Mobile</a>
      </div>
      <div style="width: 600px; margin: auto; font-size: 12px; color: #888">
        <i>Note: This is a ONE
        TIME USE only link. You will need a <b>mobile Phantom wallet</b> to claim this ticket.</i>
      </div>

    </div>
    <hr style="margin: 30px auto; width: 90%; border: 1px lightgray solid;" />
    <div style="width: 100%; border-radius: 20px;">
      <h2 style="margin-bottom: 10px; text-align: center;"> About the event </h2>
      <div style="display: flex; width: 100%;">
        <img
          src=${getEventBannerImage(event.docId)}
          width="30%" style="object-fit: contain; border-top-left-radius: 3%; border-bottom-left-radius: 3%">
          <div
          style="background-color: #f8f8f8; padding: 20px; width: 70%; border-top-right-radius: 20px; border-bottom-right-radius: 20px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div>🗓️ ${(typeof event.eventStartTime === "string"
              ? new Date(event.eventStartTime)
              : event.eventStartTime.toDate()
            ).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}</div>
            <div>🕗 ${(typeof event.eventStartTime === "string"
              ? new Date(event.eventStartTime)
              : event.eventStartTime.toDate()
            ).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}</div>
            <div>📍
              <u>
                <a target='_blank' rel="noreferrer" href=${`https://maps.google.com/?q=${event.eventLocation}`}>
                  ${event.eventLocation} </a>
              </u>
            </div>
          </div>

          <div style="display:flex;">
            <a
            target="_blank"
            rel="noreferer"
            href=${eventUrl(event.shortLink, config)}
              style="padding: 10px 16px; color: white; background-color: #72224c; border-radius: 5px; border: 1px solid #72224C; display: block; font-size: 16px;">View
              Event Details</a>
          </div>
        </div>

      </div>
      <hr style="margin: 40px auto; width: 90%; border: 1px lightgray solid;" />
      <div style="text-align: center; color: #888; display: flex; flex-direction: column; gap: 8px; margin-bottom: 30px;">
        <div>
          Have any questions? Reply to this email and we'll get back to you as soon as possible.
        </div>
        <div>
          538 Castro St. San Francisco, CA, 94114
        </div>
      </div>
    </div>
  </div>
`;

export const sendEmail = async (destination: string, data: string) => {
  const ses = new SES({
    apiVersion: "2010-12-01",
    region: process.env.SES_REGION,
    accessKeyId: process.env.SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.SES_SECRET_ACCESS_KEY,
  });

  const params: SendEmailRequest = {
    Source: "events@cardinal.so",
    Destination: {
      ToAddresses: [destination],
    },
    Message: {
      Subject: {
        Data: "Your tickets are here to be claimed!",
      },
      Body: {
        Html: {
          Data: data,
        },
      },
    },
  };

  await ses.sendEmail(params).promise();
};
