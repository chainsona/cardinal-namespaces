import type { CardinalProvider } from "@cardinal/common";
import {
  executeTransaction,
  findAta,
  getTestProvider,
  newAccountWithLamports,
  tryGetAccount,
} from "@cardinal/common";
import * as anchor from "@project-serum/anchor";
import { getAccount } from "@solana/spl-token";
import * as web3 from "@solana/web3.js";
import assert from "assert";

import {
  findClaimRequestId,
  findNamespaceId,
  getClaimRequest,
  getNameEntry,
  getNamespaceByName,
  getReverseNameEntryForNamespace,
  withClaimNameEntry,
  withCreateClaimRequest,
  withCreateNamespace,
  withInitNameEntry,
  withInitNameEntryMint,
  withRevokeNameEntry,
  withRevokeReverseEntry,
  withSetNamespaceReverseEntry,
  withUpdateClaimRequest,
} from "../src";
import { createMint } from "./utils";

describe("create-claim-revoke-transferable-name-entry", () => {
  // test params
  const namespaceName = `ns-${Math.random()}`;
  const entryName = `testname-${Math.random()}`;
  const paymentAmountDaily = new anchor.BN(0);
  const PAYMENT_MINT_START = 10000;

  // global
  let paymentMintId: web3.PublicKey;
  let mintAuthority: web3.Keypair;
  let provider: CardinalProvider;
  beforeAll(async () => {
    provider = await getTestProvider();
    mintAuthority = await newAccountWithLamports(provider.connection);
  });

  it("Creates a namespace", async () => {
    provider = await getTestProvider();
    [, paymentMintId] = await createMint(
      provider.connection,
      new anchor.Wallet(mintAuthority),
      {
        target: provider.wallet.publicKey,
        amount: PAYMENT_MINT_START,
      }
    );

    const transaction = new web3.Transaction();
    withCreateNamespace(transaction, provider.connection, provider.wallet, {
      namespaceName,
      updateAuthority: provider.wallet.publicKey,
      rentAuthority: provider.wallet.publicKey,
      approveAuthority: provider.wallet.publicKey,
      paymentAmountDaily,
      paymentMint: paymentMintId,
      transferableEntries: true,
    });
    await executeTransaction(provider.connection, transaction, provider.wallet);

    const checkNamespace = await getNamespaceByName(
      provider.connection,
      namespaceName
    );
    assert.equal(checkNamespace.parsed.name, namespaceName);
    assert.equal(checkNamespace.parsed.maxRentalSeconds, null);
    assert.equal(
      checkNamespace.parsed.paymentAmountDaily.toNumber(),
      paymentAmountDaily.toNumber()
    );
  });

  it("Init entry and mint", async () => {
    const mintKeypair = web3.Keypair.generate();
    const transaction = new web3.Transaction();

    withInitNameEntry(
      transaction,
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName
    );

    withInitNameEntryMint(
      transaction,
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      mintKeypair
    );
    await executeTransaction(
      provider.connection,
      transaction,
      provider.wallet,
      {
        signers: [mintKeypair],
      }
    );
    const checkEntry = await getNameEntry(
      provider.connection,
      namespaceName,
      entryName
    );
    assert.equal(checkEntry.parsed.name, entryName);
    assert.equal(
      checkEntry.parsed.mint.toString(),
      mintKeypair.publicKey.toString()
    );
  });

  it("Create claim request", async () => {
    const transaction = new web3.Transaction();

    withCreateClaimRequest(
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      provider.wallet.publicKey,
      transaction
    );

    await executeTransaction(provider.connection, transaction, provider.wallet);
  });

  it("Approve claim request", async () => {
    const claimRequest = await getClaimRequest(
      provider.connection,
      namespaceName,
      entryName,
      provider.wallet.publicKey
    );
    const transaction = new web3.Transaction();
    withUpdateClaimRequest(
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      claimRequest.pubkey,
      true,
      transaction
    );
    await executeTransaction(provider.connection, transaction, provider.wallet);
  });

  it("Claim", async () => {
    const entry = await getNameEntry(
      provider.connection,
      namespaceName,
      entryName
    );
    const mintId = entry.parsed.mint;

    const transaction = new web3.Transaction();
    await withClaimNameEntry(
      transaction,
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      mintId
    );
    await executeTransaction(provider.connection, transaction, provider.wallet);

    const checkNamespace = await getNamespaceByName(
      provider.connection,
      namespaceName
    );
    assert.equal(checkNamespace.parsed.name, namespaceName);
    const checkNameEntry = await getNameEntry(
      provider.connection,
      namespaceName,
      entryName
    );
    assert.equal(checkNameEntry.parsed.name, entryName);
    assert.equal(checkNameEntry.parsed.mint.toString(), mintId.toString());

    const checkRecipientTokenAccount = await getAccount(
      provider.connection,
      await findAta(mintId, provider.wallet.publicKey)
    );
    expect(Number(checkRecipientTokenAccount.amount.toString())).toEqual(1);
    expect(checkRecipientTokenAccount.isFrozen).toEqual(false);
  });

  it("Set reverse entry", async () => {
    const entry = await getNameEntry(
      provider.connection,
      namespaceName,
      entryName
    );
    const mintId = entry.parsed.mint;

    const transaction = new web3.Transaction();
    withSetNamespaceReverseEntry(
      transaction,
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      mintId
    );
    await executeTransaction(provider.connection, transaction, provider.wallet);

    const checkReverseEntry = await getReverseNameEntryForNamespace(
      provider.connection,
      provider.wallet.publicKey,
      findNamespaceId(namespaceName)
    );
    assert.equal(checkReverseEntry.parsed.entryName, entryName);
  });

  it("Revoke entry", async () => {
    const entry = await getNameEntry(
      provider.connection,
      namespaceName,
      entryName
    );
    const mintId = entry.parsed.mint;
    const namespaceId = findNamespaceId(namespaceName);
    const claimRequestId = findClaimRequestId(
      namespaceId,
      entryName,
      provider.wallet.publicKey
    );
    const transaction = new web3.Transaction();
    withCreateClaimRequest(
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      provider.wallet.publicKey,
      transaction
    );
    withUpdateClaimRequest(
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      claimRequestId,
      true,
      transaction
    );
    if (entry.parsed.reverseEntry) {
      withRevokeReverseEntry(
        transaction,
        provider.connection,
        provider.wallet,
        namespaceName,
        entryName,
        entry.parsed.reverseEntry,
        claimRequestId
      );
    }
    await withRevokeNameEntry(
      transaction,
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      provider.wallet.publicKey,
      mintId,
      claimRequestId
    );
    await executeTransaction(provider.connection, transaction, provider.wallet);

    const checkReverseEntry = await tryGetAccount(async () =>
      getReverseNameEntryForNamespace(
        provider.connection,
        findNamespaceId(namespaceName),
        provider.wallet.publicKey
      )
    );
    expect(checkReverseEntry).toEqual(null);

    const entryAfter = await getNameEntry(
      provider.connection,
      namespaceName,
      entryName
    );
    expect(entryAfter.parsed.data).toEqual(null);
    expect(entryAfter.parsed.isClaimed).toEqual(false);
    expect(entryAfter.parsed.mint.toString()).toEqual(
      web3.PublicKey.default.toString()
    );

    const checkRecipientTokenAccount = await getAccount(
      provider.connection,
      await findAta(mintId, provider.wallet.publicKey)
    );
    expect(Number(checkRecipientTokenAccount.amount.toString())).toEqual(1);
  });
});
