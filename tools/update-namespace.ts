import { tryGetAccount } from "@cardinal/common";
import { utils } from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
import {
  Keypair,
  PublicKey,
  sendAndConfirmRawTransaction,
  Transaction,
} from "@solana/web3.js";

import { getNamespaceByName, withUpdateNamespace } from "../src";
import { connectionFor } from "./connection";

export const createNamespace = async (
  namespaceName: string,
  clusterName: string
) => {
  const connection = connectionFor(clusterName);
  let transaction = new Transaction();

  const wallet = Keypair.fromSecretKey(utils.bytes.bs58.decode(""));

  const checkNamespace = await tryGetAccount(() =>
    getNamespaceByName(connection, namespaceName)
  );

  if (!checkNamespace) {
    throw Error("No namespace found");
  }

  transaction = await withUpdateNamespace(
    transaction,
    connection,
    new SignerWallet(wallet),
    namespaceName,
    {
      updateAuthority: new PublicKey(""),
      rentAuthority: new PublicKey(""),
      approveAuthority: new PublicKey(""),
      paymentAmountDaily: checkNamespace.parsed.paymentAmountDaily,
      paymentMint: checkNamespace.parsed.paymentMint,
      minRentalSeconds: checkNamespace.parsed.minRentalSeconds,
      maxRentalSeconds: checkNamespace.parsed.maxRentalSeconds || undefined,
      transferableEntries: checkNamespace.parsed.transferableEntries,
      limit: checkNamespace.parsed.limit || undefined,
      maxExpiration: checkNamespace.parsed.maxExpiration || undefined,
    }
  );
  transaction.feePayer = wallet.publicKey;
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;
  transaction.sign(wallet);
  const txid = await sendAndConfirmRawTransaction(
    connection,
    transaction.serialize(),
    {
      commitment: "confirmed",
    }
  );
  console.log(`Successful namespace update, txid ${txid}`);
};

createNamespace("discord", "mainnet").catch((e) => {
  console.log("Error:", e);
});
