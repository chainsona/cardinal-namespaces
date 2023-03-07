import type { CardinalProvider } from "@cardinal/common";
import {
  executeTransaction,
  findAta,
  getTestProvider,
  newAccountWithLamports,
  tryGetAccount,
} from "@cardinal/common";
import { withInvalidate } from "@cardinal/token-manager";
import * as anchor from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
import { getAccount } from "@solana/spl-token";
import * as web3 from "@solana/web3.js";
import assert from "assert";

import {
  findNamespaceId,
  findReverseNameEntryForNamespaceId,
  getClaimRequest,
  getNameEntry,
  getNamespaceByName,
  getReverseNameEntryForNamespace,
  withClaimNameEntry,
  withCreateClaimRequest,
  withCreateNamespace,
  withInitNameEntry,
  withInitNameEntryMint,
  withInvalidateExpiredNameEntry,
  withInvalidateExpiredReverseEntry,
  withSetNamespaceReverseEntry,
  withUpdateClaimRequest,
} from "../src";
import { createMint } from "./utils";

describe("create-claim-expire-name-entry", () => {
  // test params
  const namespaceName = `ns-${Math.random()}`;
  const entryName = `testname-${Math.random()}`;
  const mintKeypair = web3.Keypair.generate();
  const nameEntryMint = mintKeypair.publicKey;
  const invalidator = web3.Keypair.generate();
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
    [, paymentMintId] = await createMint(
      provider.connection,
      new anchor.Wallet(mintAuthority),
      {
        target: provider.wallet.publicKey,
        amount: PAYMENT_MINT_START,
      }
    );

    // airdrop invalidator
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        invalidator.publicKey,
        web3.LAMPORTS_PER_SOL
      )
    );

    const transaction = new web3.Transaction();
    withCreateNamespace(transaction, provider.connection, provider.wallet, {
      namespaceName,
      updateAuthority: provider.wallet.publicKey,
      rentAuthority: provider.wallet.publicKey,
      approveAuthority: provider.wallet.publicKey,
      paymentAmountDaily,
      paymentMint: paymentMintId,
      transferableEntries: false,
      maxExpiration: new anchor.BN(Date.now() / 1000 + 1),
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
    const transaction = new web3.Transaction();
    await withClaimNameEntry(
      transaction,
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      nameEntryMint
    );
    withSetNamespaceReverseEntry(
      transaction,
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      nameEntryMint
    );
    await executeTransaction(provider.connection, transaction, provider.wallet);

    const checkClaimRequest = await tryGetAccount(async () =>
      getClaimRequest(
        provider.connection,
        namespaceName,
        entryName,
        provider.wallet.publicKey
      )
    );
    expect(checkClaimRequest).toEqual(null);

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
    assert.equal(
      checkNameEntry.parsed.mint.toString(),
      nameEntryMint.toString()
    );

    const checkRecipientTokenAccount = await getAccount(
      provider.connection,
      await findAta(nameEntryMint, provider.wallet.publicKey)
    );
    expect(Number(checkRecipientTokenAccount.amount.toString())).toEqual(1);
    expect(checkRecipientTokenAccount.isFrozen).toEqual(true);

    const checkReverseEntry = await getReverseNameEntryForNamespace(
      provider.connection,
      provider.wallet.publicKey,
      findNamespaceId(namespaceName)
    );
    assert.equal(checkReverseEntry.parsed.entryName, entryName);
  });

  it("Fails to invalidate early", async () => {
    const transaction = new web3.Transaction();
    await withInvalidate(
      transaction,
      provider.connection,
      new SignerWallet(invalidator),
      nameEntryMint
    );
    await expect(
      executeTransaction(provider.connection, transaction, provider.wallet, {
        silent: true,
      })
    ).rejects.toThrow();
  });

  it("Wait and invalidate token", async () => {
    await new Promise((r) => setTimeout(r, 1000));
    const nameEntry = await getNameEntry(
      provider.connection,
      namespaceName,
      entryName
    );
    const mintId = nameEntry.parsed.mint;

    const transaction = new web3.Transaction();
    await withInvalidate(
      transaction,
      provider.connection,
      new SignerWallet(invalidator),
      mintId
    );
    await executeTransaction(
      provider.connection,
      transaction,
      new anchor.Wallet(invalidator)
    );

    const checkRecipientTokenAccount = await getAccount(
      provider.connection,
      await findAta(mintId, provider.wallet.publicKey)
    );
    expect(Number(checkRecipientTokenAccount.amount.toString())).toEqual(0);
  });

  it("Invalidate entry", async () => {
    const nameEntry = await getNameEntry(
      provider.connection,
      namespaceName,
      entryName
    );
    const namespaceDataBefore = await getNamespaceByName(
      provider.connection,
      namespaceName
    );

    const transaction = new web3.Transaction();
    await withInvalidateExpiredReverseEntry(
      transaction,
      provider.connection,
      new SignerWallet(invalidator),
      {
        namespaceName,
        entryName,
        mintId: nameEntry.parsed.mint,
        reverseEntryId: nameEntry.parsed.reverseEntry!,
      }
    );

    await withInvalidateExpiredNameEntry(
      transaction,
      provider.connection,
      new SignerWallet(invalidator),
      {
        namespaceName,
        entryName,
        mintId: nameEntry.parsed.mint,
      }
    );
    await executeTransaction(
      provider.connection,
      transaction,
      new anchor.Wallet(invalidator)
    );

    const namespaceDataAfter = await getNamespaceByName(
      provider.connection,
      namespaceName
    );

    expect(namespaceDataAfter.parsed.count).toEqual(
      namespaceDataBefore.parsed.count - 1
    );

    const reverseEntryId = findReverseNameEntryForNamespaceId(
      findNamespaceId(namespaceName),
      provider.wallet.publicKey
    );
    expect(nameEntry.parsed.reverseEntry?.toString()).toEqual(
      reverseEntryId.toString()
    );
    const checkReverseEntry = await tryGetAccount(async () =>
      getReverseNameEntryForNamespace(
        provider.connection,
        provider.wallet.publicKey,
        findNamespaceId(namespaceName)
      )
    );
    expect(checkReverseEntry).toEqual(null);

    const entryAfter = await tryGetAccount(() =>
      getNameEntry(provider.connection, namespaceName, entryName)
    );
    expect(entryAfter?.parsed.isClaimed).toBeFalsy();
    expect(entryAfter?.parsed.data).toBeNull();

    const checkNamespaceTokenAccount = await getAccount(
      provider.connection,
      await findAta(nameEntry.parsed.mint, findNamespaceId(namespaceName), true)
    );
    expect(Number(checkNamespaceTokenAccount.amount.toString())).toEqual(1);
  });
});
