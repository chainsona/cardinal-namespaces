import { SES } from "aws-sdk";
import type { SendEmailRequest } from "aws-sdk/clients/ses";

const approvalSuccessfulEmail = (
  eventName: string,
  ticketName: string,
  eventURL: string,
  claimURLs: string[]
) => `
<div>
<p>
Thanks for purchasing ${claimURLs.length} ${ticketName} ${
  claimURLs.length === 1 ? "ticket" : "tickets"
} to <a href=${eventURL}>${eventName}</a>! <br/><br/>
Use the ${claimURLs.length === 1 ? "link" : "links"} below to claim your NFT ${
  claimURLs.length === 1 ? "ticket" : "tickets"
} for the event: <br/><br/><br/>
${claimURLs
  .map(
    (url, index) =>
      `Ticket ${
        index + 1
      }: Claim Ticket <a href=${url}>From Laptop</a> or <a href=${url}>From Mobile</a> (Phantom Wallet Required)<br/></br/>`
  )
  .join("")}
${
  claimURLs.length === 1
    ? "This is a ONE TIME USE only lin. Feel free to share this link to anyone you want to claim your ticket."
    : "These are ONE TIME USE only links. Feel free to share these links them with your friends or anyone that is coming with you."
}
<br/><br/><br/>
Best,<br/>
The Cardinal Team
</p>
</div>`;

export const sendEmail = async (
  destination: string,
  eventName: string,
  ticketName: string,
  eventURL: string,
  claimURLs: string[]
) => {
  const ses = new SES({
    apiVersion: "2010-12-01",
    region: "us-west-2",
    accessKeyId: process.env.SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.SES_SECRET_ACCESS_KEY,
  });

  console.log("destination", destination);
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
          Data: approvalSuccessfulEmail(
            eventName,
            ticketName,
            eventURL,
            claimURLs
          ),
        },
      },
    },
  };

  await ses.sendEmail(params).promise();
};
