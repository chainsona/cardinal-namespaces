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

export const updateNamespace = async (
  namespaceName: string,
  clusterName: string
) => {
  const connection = connectionFor(clusterName);
  let transaction = new Transaction();

  const wallet = Keypair.fromSecretKey(utils.bytes.bs58.decode(""));
  const namespace = await getNamespaceByName(connection, namespaceName);
  const newAuthority = new PublicKey(
    "twtXa9zEztzPTvmjqQMQEatUXUfoY3GVsxKLdLZQMi6"
  );
  transaction = withUpdateNamespace(
    transaction,
    connection,
    new SignerWallet(wallet),
    namespaceName,
    {
      updateAuthority: newAuthority,
      rentAuthority: newAuthority,
      approveAuthority: newAuthority,
      paymentAmountDaily: namespace.parsed.paymentAmountDaily,
      paymentMint: namespace.parsed.paymentMint,
      minRentalSeconds: namespace.parsed.minRentalSeconds,
      maxRentalSeconds: namespace.parsed.maxRentalSeconds ?? undefined,
      transferableEntries: namespace.parsed.transferableEntries,
      limit: namespace.parsed.limit ?? undefined,
      maxExpiration: namespace.parsed.maxExpiration ?? undefined,
      schema: namespace.parsed.schema,
      invalidationType: namespace.parsed.invalidationType,
    }
  );
  transaction.feePayer = wallet.publicKey;
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;
  transaction.sign(wallet);
  await sendAndConfirmRawTransaction(connection, transaction.serialize(), {
    commitment: "confirmed",
  });
};

updateNamespace("twitter", "mainnet")
  .then(() => {
    console.log("success");
  })
  .catch((e) => {
    console.log("Error:", e);
  });
