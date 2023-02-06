import {
  CardinalProvider,
  getTestProvider,
  newAccountWithLamports,
} from "@cardinal/common";
import * as anchor from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
import * as web3 from "@solana/web3.js";
import assert from "assert";
import { BN } from "bn.js";

import {
  getNamespace,
  getNamespaceByName,
  NAMESPACES_PROGRAM_ID,
  withCreateNamespace,
  withUpdateNamespace,
} from "../../src";
import { createMint, NAMESPACE_SEED } from "../utils";

describe("namespace-create-update", () => {
  const NAMESPACE_NAME = `ns2-${Math.random()}`;
  let paymentMintId: web3.PublicKey;

  let mintAuthority: web3.Keypair;
  let provider: CardinalProvider;
  beforeAll(async () => {
    provider = await getTestProvider();
    mintAuthority = await newAccountWithLamports(provider.connection);
  });

  it("Creates a namespace", async () => {
    [, paymentMintId] = await createMint(
      provider.connection,
      new anchor.Wallet(mintAuthority),
      {
        target: provider.wallet.publicKey,
      }
    );

    const [namespaceId] = await web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode(NAMESPACE_SEED),
        anchor.utils.bytes.utf8.encode(NAMESPACE_NAME),
      ],
      NAMESPACES_PROGRAM_ID
    );

    const transaction = new web3.Transaction();

    await withCreateNamespace(
      transaction,
      provider.connection,
      provider.wallet,
      {
        namespaceName: NAMESPACE_NAME,
        updateAuthority: provider.wallet.publicKey,
        rentAuthority: provider.wallet.publicKey,
        approveAuthority: provider.wallet.publicKey,
        minRentalSeconds: new BN(100),
        maxRentalSeconds: new BN(86400),
        paymentAmountDaily: new BN(1),
        paymentMint: paymentMintId,
        transferableEntries: true,
      }
    );
    transaction.feePayer = provider.wallet.publicKey;
    transaction.recentBlockhash = (
      await provider.connection.getRecentBlockhash("max")
    ).blockhash;
    await provider.wallet.signTransaction(transaction);
    await web3.sendAndConfirmRawTransaction(
      provider.connection,
      transaction.serialize()
    );

    const namespaceAccount = await getNamespace(
      provider.connection,
      namespaceId
    );
    assert.equal(namespaceAccount.parsed.name, NAMESPACE_NAME);
    assert.equal(namespaceAccount.parsed.maxRentalSeconds, 86400);
  });

  it("Update a namespace not authority", async () => {
    const transaction = new web3.Transaction();
    const namespace = await getNamespaceByName(
      provider.connection,
      NAMESPACE_NAME
    );
    await withUpdateNamespace(
      transaction,
      provider.connection,
      provider.wallet,
      NAMESPACE_NAME,
      {
        updateAuthority: mintAuthority.publicKey,
        rentAuthority: mintAuthority.publicKey,
        approveAuthority: mintAuthority.publicKey,
        minRentalSeconds: new BN(100),
        maxRentalSeconds: new BN(86400),
        paymentAmountDaily: new BN(1),
        paymentMint: paymentMintId,
        transferableEntries: true,
        schema: namespace.parsed.schema,
        invalidationType: namespace.parsed.invalidationType,
      }
    );
    transaction.feePayer = mintAuthority.publicKey;
    transaction.recentBlockhash = (
      await provider.connection.getRecentBlockhash("max")
    ).blockhash;
    await new SignerWallet(mintAuthority).signTransaction(transaction);

    await assert.rejects(async () => {
      await web3.sendAndConfirmRawTransaction(
        provider.connection,
        transaction.serialize()
      );
    });
  });

  it("Update a namespace", async () => {
    const [namespaceId] = await web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode(NAMESPACE_SEED),
        anchor.utils.bytes.utf8.encode(NAMESPACE_NAME),
      ],
      NAMESPACES_PROGRAM_ID
    );
    const namespace = await getNamespaceByName(
      provider.connection,
      NAMESPACE_NAME
    );

    const transaction = new web3.Transaction();
    await withUpdateNamespace(
      transaction,
      provider.connection,
      provider.wallet,
      NAMESPACE_NAME,
      {
        updateAuthority: provider.wallet.publicKey,
        rentAuthority: provider.wallet.publicKey,
        approveAuthority: provider.wallet.publicKey,
        minRentalSeconds: new BN(100),
        maxRentalSeconds: new BN(86500),
        paymentAmountDaily: new BN(1),
        paymentMint: paymentMintId,
        transferableEntries: true,
        schema: namespace.parsed.schema,
        invalidationType: namespace.parsed.invalidationType,
      }
    );
    transaction.feePayer = provider.wallet.publicKey;
    transaction.recentBlockhash = (
      await provider.connection.getRecentBlockhash("max")
    ).blockhash;
    await provider.wallet.signTransaction(transaction);
    await web3.sendAndConfirmRawTransaction(
      provider.connection,
      transaction.serialize()
    );

    const namespaceAccount = await getNamespace(
      provider.connection,
      namespaceId
    );
    assert.equal(namespaceAccount.parsed.name, NAMESPACE_NAME);
    assert.equal(namespaceAccount.parsed.maxRentalSeconds, 86500);
  });
});
