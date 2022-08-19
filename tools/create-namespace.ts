import { utils } from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
import {
  Keypair,
  PublicKey,
  sendAndConfirmRawTransaction,
  Transaction,
} from "@solana/web3.js";

import { withCreateNamespace } from "../src";
import { connectionFor } from "./connection";

export const createNamespace = async (
  namespaceName: string,
  clusterName: string
) => {
  const connection = connectionFor(clusterName);
  let transaction = new Transaction();

  const wallet = Keypair.fromSecretKey(
    utils.bytes.bs58.decode(utils.bytes.bs58.encode([]))
  );

  transaction = await withCreateNamespace(
    transaction,
    connection,
    new SignerWallet(wallet),
    {
      namespaceName: namespaceName,
      updateAuthority: wallet.publicKey,
      rentAuthority: wallet.publicKey,
      approveAuthority: wallet.publicKey,
      paymentMint: new PublicKey("So11111111111111111111111111111111111111112"),
      transferableEntries: false,
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
  console.log(`Successful namespace creation, txid ${txid}`);
};

createNamespace("github", "mainnet").catch((e) => {
  console.log("Error:", e);
});
