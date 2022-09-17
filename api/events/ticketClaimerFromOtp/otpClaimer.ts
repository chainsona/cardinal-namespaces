import { emptyWallet } from "@cardinal/common";
import { utils } from "@project-serum/anchor";
import { Keypair, Transaction } from "@solana/web3.js";

import { withInitAndClaim } from "../../common/claimUtils";
import { connectionFor } from "../../common/connection";
import { publicKeyFrom } from "../common";
import type { OtpClaimData } from "../firebase";
import { getEvent, getTicket } from "../firebase";

export async function otpClaim(data: OtpClaimData): Promise<{
  status: number;
  transaction?: string;
  message?: string;
  error?: string;
}> {
  // 1. get ticket
  const checkTicket = await getTicket(data.ticketId);
  // 2. get event
  const checkEvent = await getEvent(checkTicket.eventId);
  // 3. get connection
  const connection = connectionFor(checkEvent.environment);
  // 4. get user
  const userPublicKey = publicKeyFrom(data.account, "Invalid claimer");

  let requestor: Keypair;
  try {
    requestor = Keypair.fromSecretKey(utils.bytes.bs58.decode(data.otp));
  } catch (e) {
    throw `Invalid otp secret key`;
  }
  const userWallet = emptyWallet(userPublicKey);
  const transaction = new Transaction();

  const mintKeypair = Keypair.generate();
  await withInitAndClaim(
    connection,
    userWallet,
    transaction,
    data.ticketId,
    data.entryName,
    mintKeypair,
    0,
    requestor.publicKey
  );

  transaction.feePayer = userWallet.publicKey;
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;
  transaction.partialSign(mintKeypair);
  transaction.partialSign(requestor);
  const copiedTx = Transaction.from(
    transaction.serialize({
      verifySignatures: false,
      requireAllSignatures: false,
    })
  );
  const serialized = copiedTx
    .serialize({
      verifySignatures: false,
      requireAllSignatures: false,
    })
    .toString("base64");

  return {
    status: 200,
    transaction: serialized,
    message: `Built transaction to create ticket`,
  };
}
