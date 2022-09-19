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
import { getTicket, tryGetEventFromShortlink } from "../firebase";
import { connectionFor } from "./connection";
import { createMintTransaction } from "./utils";

const wallet = Keypair.fromSecretKey(
  utils.bytes.bs58.decode(process.env.AIRDROP_WALLET || "")
);

export const getLinks = async (
  numLinks: number,
  cluster = "devnet",
  baseUrl = "https://events.cardinal.so",
  ticketId = "crd-vF1rCIVARtDGV8udx9tZ-30573",
  eventShortLink = "solana-spaces-unveiling",
  config = "solana-spaces",
  destination = "jpbogle22@gmail.com"
) => {
  const allLinks: string[] = [];
  const connection = connectionFor(cluster);
  const event = await tryGetEventFromShortlink(eventShortLink);
  if (!event) throw "Invalid event";
  const ticket = await getTicket(ticketId);

  for (let i = 0; i < numLinks; i++) {
    console.log(`----------(${i}/${numLinks})--------------`);

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
      await sendAndConfirmRawTransaction(
        connection,
        mintTransaction.serialize(),
        {
          commitment: "confirmed",
        }
      );

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
            creators: null,
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
          invalidationType: InvalidationType.Return,
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
      await sendAndConfirmRawTransaction(connection, transaction.serialize(), {
        commitment: "confirmed",
      });

      const claimLink = `${baseUrl}/solana-spaces/solana-spaces-unveiling/claim?mint=${masterEditionMint.publicKey.toString()}&otp=${utils.bytes.bs58.encode(
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
        )
      );
    } catch (e) {
      console.log("Failed", e);
    }
  }

  return allLinks;
};

getLinks(1, "mainnet")
  .then((links) => {
    console.log(links);
  })
  .catch((e) => {
    console.log(e);
  });
