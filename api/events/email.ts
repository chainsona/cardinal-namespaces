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
<div>
<img src=${getEventBannerImage(
  event.docId
)} alt="event-image" style="width: 100%; max-width: 1000px; margin: auto; border-radius: 3%;">
<h3>
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
      `Ticket ${
        index + 1
      }: Claim Ticket <a href=${url}>From Laptop</a> or <a href=${`https://phantom.app/ul/browse/${encodeURIComponent(
        url
      )}`}>From Mobile</a> (Phantom Wallet Required)<br/></br/>`
  )
  .join("")}
<br />
${
  claimURLs.length === 1
    ? "This is a ONE TIME USE only link. Feel free to share this link to anyone you want to claim your ticket."
    : "These are ONE TIME USE only links. Feel free to share these links them with your friends or anyone that is coming with you."
}
<br/><br/>

<b>Location: </b>${event.eventLocation} <br/>
<b>Date: </b> ${new Date(event.eventStartTime).toLocaleTimeString([], {
  hour: "numeric",
  minute: "2-digit",
})}
<br/><br/>
Best,<br/>
<a href="https://www.cardinal.so/">The Cardinal Team</a>
</div>`;

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
