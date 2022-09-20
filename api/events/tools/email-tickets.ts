/* eslint-disable simple-import-sort/imports, import/first */
import * as dotenv from "dotenv";

dotenv.config();

import { issueToken } from "@cardinal/token-manager";
import {
  InvalidationType,
  TokenManagerKind,
} from "@cardinal/token-manager/dist/cjs/programs/tokenManager";
import {
  CreateMasterEditionV3,
  CreateMetadataV2,
  Creator,
  DataV2,
  MasterEdition,
  Metadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { BN, utils } from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
import {
  Keypair,
  sendAndConfirmRawTransaction,
  Transaction,
} from "@solana/web3.js";
import { approvalSuccessfulEmail, sendEmail } from "../email";
import type { FirebaseApproval, FirebaseResponse } from "../firebase";
import {
  authFirebase,
  eventFirestore,
  getApprovalRef,
  getTicket,
  tryGetEventFromShortlink,
} from "../firebase";
import { connectionFor } from "./connection";
import { createMintTransaction } from "./utils";
import { collection, doc, Timestamp, writeBatch } from "firebase/firestore";

const wallet = Keypair.fromSecretKey(
  utils.bytes.bs58.decode(process.env.AIRDROP_WALLET || "")
);

export const getLinks = async (
  userData: UserData[],
  cluster = "devnet",
  baseUrl = "https://events.cardinal.so",
  ticketId = "crd-vF1rCIVARtDGV8udx9tZ-30573",
  eventShortLink = "solana-spaces-unveiling",
  config = "solana-spaces",
  dryRun = false
) => {
  const allLinks: string[] = [];
  const connection = connectionFor(cluster);
  const event = await tryGetEventFromShortlink(eventShortLink);
  if (!event) throw "Invalid event";
  const ticket = await getTicket(ticketId);
  const failedUserData: { userData: UserData; claimLink: string }[] = [];

  for (let i = 0; i < userData.length; i++) {
    console.log(`----------(${i + 1}/${userData.length})--------------`);
    const destination = userData[i].email;
    const firstName = userData[i].firstName ?? "";
    let claimLink = "";
    try {
      const mintTx = new Transaction();
      const masterEditionMint = Keypair.generate();
      const [masterEditionTokenAccountId] = await createMintTransaction(
        mintTx,
        connection,
        new SignerWallet(wallet),
        wallet.publicKey,
        masterEditionMint.publicKey,
        1
      );
      const mintTransaction = new Transaction();
      mintTransaction.instructions = [...mintTx.instructions];
      mintTransaction.feePayer = wallet.publicKey;
      mintTransaction.recentBlockhash = (
        await connection.getRecentBlockhash("max")
      ).blockhash;
      mintTransaction.sign(wallet, masterEditionMint);
      !dryRun &&
        (await sendAndConfirmRawTransaction(
          connection,
          mintTransaction.serialize(),
          {
            commitment: "confirmed",
          }
        ));

      // create master edition
      const masterEditionMetadataId = await Metadata.getPDA(
        masterEditionMint.publicKey
      );
      const metadataTx = new CreateMetadataV2(
        { feePayer: wallet.publicKey },
        {
          metadata: masterEditionMetadataId,
          metadataData: new DataV2({
            name: ticketId,
            symbol: "NAME",
            uri: `https://nft.cardinal.so/metadata/${masterEditionMint.publicKey.toString()}?name=${Math.random()
              .toString(36)
              .slice(6)}`,
            sellerFeeBasisPoints: 0,
            creators: [
              new Creator({
                address: wallet.publicKey.toString(),
                verified: true,
                share: 100,
              }),
            ],
            collection: null,
            uses: null,
          }),
          updateAuthority: wallet.publicKey,
          mint: masterEditionMint.publicKey,
          mintAuthority: wallet.publicKey,
        }
      );

      const masterEditionId = await MasterEdition.getPDA(
        masterEditionMint.publicKey
      );
      const masterEditionTx = new CreateMasterEditionV3(
        {
          feePayer: wallet.publicKey,
          recentBlockhash: (await connection.getRecentBlockhash("max"))
            .blockhash,
        },
        {
          edition: masterEditionId,
          metadata: masterEditionMetadataId,
          updateAuthority: wallet.publicKey,
          mint: masterEditionMint.publicKey,
          mintAuthority: wallet.publicKey,
          maxSupply: new BN(0),
        }
      );

      // issue token
      const [issueTransaction, tokenManagerId, otp] = await issueToken(
        connection,
        new SignerWallet(wallet),
        {
          visibility: "private",
          mint: masterEditionMint.publicKey,
          issuerTokenAccountId: masterEditionTokenAccountId,
          timeInvalidation: {
            maxExpiration: 1664514000,
          },
          kind: TokenManagerKind.Edition,
          invalidationType: InvalidationType.Release,
        }
      );
      if (!otp) throw "Invalid otp";

      const transaction = new Transaction();
      transaction.instructions = [
        ...metadataTx.instructions,
        ...masterEditionTx.instructions,
        ...issueTransaction.instructions,
      ];
      transaction.feePayer = wallet.publicKey;
      transaction.recentBlockhash = (
        await connection.getRecentBlockhash("max")
      ).blockhash;
      transaction.sign(wallet);
      !dryRun &&
        (await sendAndConfirmRawTransaction(
          connection,
          transaction.serialize(),
          {
            commitment: "confirmed",
          }
        ));

      claimLink = `${baseUrl}/solana-spaces/solana-spaces-unveiling/claim?mint=${masterEditionMint.publicKey.toString()}&otp=${utils.bytes.bs58.encode(
        otp?.secretKey
      )}&ticketId=${ticketId}`;
      const tkm = await connection.getAccountInfo(tokenManagerId);
      if (!tkm) {
        console.log("Missing token manager", tokenManagerId.toString());
      } else {
        console.log(
          `Master edition data created mintId=(${masterEditionMint.publicKey.toString()}) masterEditionId=(${masterEditionId.toString()}) metadataId=(${masterEditionMetadataId.toString()}) link=(${claimLink})`
        );
        allLinks.push(claimLink);
      }

      await sendEmail(
        destination,
        approvalSuccessfulEmail(
          event,
          ticket.ticketName,
          ticket.docId,
          claimLink,
          config
        ),
        ticket.ticketDescription
      );

      await authFirebase();
      const responseRef = doc(collection(eventFirestore, "responses"));
      const firebaseBatch = writeBatch(eventFirestore);
      const entryName = `${Math.random().toString(36).slice(6)}`;
      firebaseBatch.set(responseRef, {
        eventId: event.docId,
        ticketId: ticketId,
        timestamp: Timestamp.fromDate(new Date()),
        environment: event.environment,
        payerAddress: wallet.publicKey.toString(),
        claimerAddress: null,
        ticketAmount: 1,
        formResponse: null,
        payerTransactionId: null,
        payerSignerPubkey: otp.publicKey.toString(),
        approvalData: {
          type: "email",
          value: destination,
          entryName,
          approvalSignerPubkey: otp.publicKey.toString(),
          firstName: firstName,
        },
        approvalTransactionId: null,
        approvalSignerPubkey: otp.publicKey.toString(),
        claimTransactionId: null,
        claimSignerPubkey: null,
      } as FirebaseResponse);

      const approvalRef = getApprovalRef(otp.publicKey.toString());
      firebaseBatch.set(approvalRef, {
        responseId: responseRef.id,
        secretKey: utils.bytes.bs58.encode(otp.secretKey),
        approvalData: null,
      } as FirebaseApproval);
      !dryRun && (await firebaseBatch.commit());
    } catch (e) {
      console.log("Failed", e);
      failedUserData.push({ userData: userData[i], claimLink: claimLink });
    }
  }

  if (failedUserData.length > 0) {
    console.log(failedUserData);
  }

  return allLinks;
};

type UserData = {
  email: string;
  firstName?: string;
};

const users: UserData[] = [
  {
    email: "avinash@cardinal.so",
    firstName: "Avinash",
  },
];

getLinks(users, "mainnet")
  .then((links) => {
    console.log(links);
  })
  .catch((e) => {
    console.log(e);
  });
