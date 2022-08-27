import { emptyWallet, tryGetAccount, tryPublicKey } from "@cardinal/common";
import { getNamespaceByName } from "@cardinal/namespaces";
import { utils } from "@project-serum/anchor";
import { Keypair, Transaction } from "@solana/web3.js";

import { withInitAndClaim } from "../../common/claimUtils";
import { connectionFor } from "../../common/connection";
import type { OtpClaimData } from "../firebase";
import { tryGetEvent, tryGetEventTicket } from "../firebase";

export async function otpClaim(data: OtpClaimData): Promise<{
  status: number;
  transaction?: string;
  message?: string;
  error?: string;
}> {
  const checkTicket = await tryGetEventTicket(data.ticketId);
  if (!checkTicket) {
    return {
      status: 400,
      message: JSON.stringify({ message: "Ticket not found" }),
    };
  }
  const checkEvent = await tryGetEvent(checkTicket.eventId);
  if (!checkEvent) {
    return {
      status: 400,
      message: JSON.stringify({ message: "Event for ticket not found" }),
    };
  }

  const connection = connectionFor(checkEvent.environment);
  let approverAuthority: Keypair | undefined;
  try {
    approverAuthority = Keypair.fromSecretKey(
      utils.bytes.bs58.decode(
        process.env.EVENT_APPROVER_KEY ||
          "2NfHThV9r3qS4YfmroLrwAJQG1XbjFwsunt8jDMykreieojVnyUcSuBqStcUy2kaAguYR27Myi4dHfMkasWFHVKA"
      )
    );
  } catch {
    throw new Error(`Events pk incorrect or not found`);
  }
  const claimerPublicKey = tryPublicKey(data.account);
  if (!claimerPublicKey) {
    return {
      status: 400,
      message: `Invalid claimer pubkey`,
    };
  }

  let requestor: Keypair;
  try {
    requestor = Keypair.fromSecretKey(utils.bytes.bs58.decode(data.otp));
  } catch (e) {
    return {
      status: 400,
      message: `Invalid otp secret key`,
    };
  }
  const claimerWallet = emptyWallet(claimerPublicKey);
  const transaction = new Transaction();

  const checkNamespace = await tryGetAccount(() =>
    getNamespaceByName(connection, data.ticketId)
  );
  if (!checkNamespace?.parsed) {
    return {
      status: 400,
      message: `No ticket namespace found`,
    };
  }

  const mintKeypair = Keypair.generate();
  await withInitAndClaim(
    connection,
    claimerWallet,
    transaction,
    data.ticketId,
    data.entryName,
    mintKeypair,
    0,
    requestor.publicKey
  );

  transaction.feePayer = claimerWallet.publicKey;
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
