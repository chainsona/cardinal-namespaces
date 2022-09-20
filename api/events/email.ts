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
) => {
  const eventUri = eventUrl(event.shortLink, config);
  const eventStartDate = (
    typeof event.eventStartTime === "string"
      ? new Date(event.eventStartTime)
      : event.eventStartTime.toDate()
  ).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const eventStartime = (
    typeof event.eventStartTime === "string"
      ? new Date(event.eventStartTime)
      : event.eventStartTime.toDate()
  ).toLocaleTimeString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  const locationLink = `https://maps.google.com/?q=${encodeURIComponent(
    event.eventLocation
  )}`;
  const calendarInviteLink = `http://www.google.com/calendar/event?action=TEMPLATE&text=${encodeURIComponent(
    event.eventName
  )}&dates=${encodeURIComponent(
    new Date(event.eventStartTime.toString()).toLocaleString()
  )}&details=Event%20Details%20Here&location=${encodeURIComponent(
    event.eventLocation
  )}`;

  return `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700&display=swap" rel="stylesheet">

<div style="display:block; margin-left: auto; margin-right: auto; color: black; font-family:-apple-system, Inter, sans-serif;">
  <div style="max-width:786px; border-radius: 20px;">
    <img src="https://i.imgur.com/gTMiSl4.png" width="180px" style="margin-top: 20px; margin-bottom: 20px; border-radius: 3%;" />
    <div style="background-color: #f8f8f8; padding: 20px; text-align: center; border-radius: 20px;">
      <img
        src=${`https://firebasestorage.googleapis.com/v0/b/cardinal-events.appspot.com/o/tickets%2F${ticketId}%2Fimage.png?alt=media`}
        alt="event-image" style="width: 200px; display: block; margin: auto; border-radius: 3%">
      <h2 style="margin-top: 10px; margin-bottom: 0px;">${event.eventName}</h2>

      <h3> Claim your <u><a
      target="_blank"
      rel="noreferer"
      href=${eventUri} style="text-decoration: none; color: inherit;"</a>${ticketName} ticket</u>! </h3>
      <h5> <a style="color: inherit; target='_blank' rel="noreferrer" href=${locationLink}>${
    event.eventLocation
  } </a> at <a style="color: inherit;" target='_blank' rel="noreferrer" href=${calendarInviteLink}>${eventStartDate}</a> </h5>
      <div style="display: block; margin-left: auto; margin-right: auto; margin-bottom: 20px; width: max-content;">
        <a
        target="_blank"
        rel="noreferer"
        href=${`https://phantom.app/ul/browse/${encodeURIComponent(claimURL)}`}
          style="padding: 12px 18px; color: white; background-color: #8820fe; border-radius: 5px; display: block; font-size: 16px; text-decoration: none;">Claim
          on Mobile</a>
      </div>
      <div style="width: 600px; margin: auto; font-size: 14px; color: #000 font-weight: 500;">
        Note: This is a ONE TIME USE only link that is only compatible with your name and email address. You will need a <b>mobile Phantom wallet</b> to claim this ticket. This ticket is non-transferrable.
      </div>

    </div>
    <hr style="margin: 30px auto; width: 90%; border: 1px lightgray solid;" />
    <div style="width: 100%; border-radius: 20px;">
      <h2 style="margin-bottom: 15px; text-align: center;"> About the event </h2>
      <div style="text-align: center; margin: 0px auto; background-color: #f8f8f8; overflow: hidden; border-radius: 20px; display: flex; justify-content: center; width: auto;">
        <img src=${getEventBannerImage(
          event.docId
        )} width="49%" style="float: left; object-fit: contain; display: inline-block; vertical-align:middle;">
        <div style="width: 2%; display: inline-block; float: left"></div>
        <div
          style="float: left; justify-self: start; padding-top: 20px; padding-bottom: 20px; height: 100%; width: 49%; display: inline-block; text-align: left; vertical-align: top;">
          <div style="font-weight: 600; justify-content: center;">
            <a style="text-decoration: none; color: inherit;" target='_blank' rel="noreferrer" href=${calendarInviteLink}>
              <div style="display: block; padding-bottom: 8px;">
                🗓️ ${eventStartDate}
              </div>
              <div style="display: block; padding-bottom: 8px;">
                🕗 ${eventStartime}
              </div>
            </a>
            <div style="padding-bottom: 12px; display: block;">📍
              <a style="color: inherit; target='_blank' rel="noreferrer" href=${locationLink}>${
    event.eventLocation
  }</a>
            </div>
          </div>
          <div style="display:block; width: max-content; margin-top: 20px;">
            <a
            target="_blank"
            rel="noreferer"
            href=${eventUri}
              style="padding: 12px 16px; color: white; text-decoration: none; background-color: #8820fe; border-radius: 5px; border: 1px solid #8820fe; display: block; font-size: 16px;">View
              Event Details</a>
          </div>
        </div>
      </div>
      <hr style="margin: 40px auto; width: 90%; border: 1px lightgray solid;" />
      <div style="text-align: center; color: #888; margin-bottom: 30px;">
        <div style="margin-bottom: 8px;">
          Have any questions? Reply to this email and we'll get back to you as soon as possible.
        </div>
        <div>
          538 Castro St. San Francisco, CA, 94114
        </div>
      </div>
    </div>
  </div>
`;
};

// <img src="https://imgur.com/a/Zj2IykL"
// alt="solana-logo" style="width: 200px; display: block; margin: 5px auto;"/>

export const sendEmail = async (
  destination: string,
  data: string,
  subject?: string | null
) => {
  const ses = new SES({
    apiVersion: "",
    region: process.env.SES_REGION || "",
    accessKeyId: process.env.SES_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.SES_SECRET_ACCESS_KEY || "",
  });

  const params: SendEmailRequest = {
    Source: "events@cardinal.so",
    Destination: {
      ToAddresses: [destination],
    },
    Message: {
      Subject: {
        Data: subject ?? "Your tickets are here to be claimed!",
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
