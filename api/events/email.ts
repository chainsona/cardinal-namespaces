import { SES } from "aws-sdk";
import type { SendEmailRequest } from "aws-sdk/clients/ses";

import { eventUrl } from "./common";
import type { FirebaseEvent } from "./firebase";
import { getEventBannerImage } from "./firebase";

export const approvalSuccessfulEmail = (
  event: FirebaseEvent,
  ticketName: string,
  claimURLs: string[],
  config: string | null
) => `
<div style="display:flex; justify-content: center;">
<div style="width:786px; background-color: #f8f8f8; border-radius: 20px; font-family:sans-serif;">
<img src=${getEventBannerImage(
  event.docId
)} alt="event-image" style="width: 100%; max-width: 1000px; margin: auto; border-radius: 3%;">
<h3>
<div style=" padding: 20px;  ">
Thank you for purchasing ${claimURLs.length} ${ticketName} ${
  claimURLs.length === 1 ? "ticket" : "tickets"
} to <a href="${eventUrl(event.shortLink, config)}">${event.eventName}</a>!
</h3>
<h4>
Use the ${claimURLs.length === 1 ? "link" : "links"} below to claim your NFT ${
  claimURLs.length === 1 ? "ticket" : "tickets"
} for the event:
</h4>
<br />
${claimURLs
  .map(
    (url, index) =>
      `<b>Ticket ${
        index + 1
      }:</b> Claim Ticket <a href=${url}>From Laptop</a> or <a href=${`https://phantom.app/ul/browse/${encodeURIComponent(
        url
      )}`}>From Mobile</a> (Phantom Wallet Required)<br/></br/>`
  )
  .join("")}
<br />
${
  claimURLs.length === 1
    ? "<i>Note: This is a ONE TIME USE only link. Feel free to share this link to anyone you want to claim your ticket.</i>"
    : "<i>Note: These are ONE TIME USE only links. Feel free to share these links them with your friends or anyone that is coming with you.</i>"
}
<br/><br/><hr/>
<h3 style="margin-bottom: 0; padding-bottom: 0;">Event Details:</h3> <br/>  

<b>📍 Location: </b><u>
    <a
      target='_blank'
      rel="noreferrer" 
      href=${`https://maps.google.com/?q=${event.eventLocation}`}
    >
    ${event.eventLocation}
    </a></u> <br/>
  <b>⏱ Date and Time: </b> ${new Date(event.eventStartTime).toLocaleTimeString(
    [],
    {
      hour: "numeric",
      minute: "2-digit",
    }
  )} <br/>
  <b>🖊 Event Description:</b> <br/><br/>
    ${event.eventDescription}

    <br/><br/><hr/><br/>
Best,<br/>
<a href="https://www.cardinal.so/">The Cardinal Team</a>
</div></div>`;

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
