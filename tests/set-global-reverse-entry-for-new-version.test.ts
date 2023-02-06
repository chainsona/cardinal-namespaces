import {
  CardinalProvider,
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
  findDeprecatedReverseEntryId,
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
  withSetGlobalReverseEntry,
  withSetNamespaceReverseEntry,
  withUpdateClaimRequest,
} from "../src";
import { createMint } from "./utils";

describe("set-global-reverse-entry-for-new-version", () => {
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
    await withCreateNamespace(
      transaction,
      provider.connection,
      provider.wallet,
      {
        namespaceName,
        updateAuthority: provider.wallet.publicKey,
        rentAuthority: provider.wallet.publicKey,
        approveAuthority: provider.wallet.publicKey,
        paymentAmountDaily,
        paymentMint: paymentMintId,
        transferableEntries: false,
        maxExpiration: new anchor.BN(Date.now() / 1000 + 1),
      }
    );
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

    await withInitNameEntry(
      transaction,
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName
    );

    await withInitNameEntryMint(
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

    await withCreateClaimRequest(
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
    await withUpdateClaimRequest(
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
    await withSetNamespaceReverseEntry(
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
      (
        await findNamespaceId(namespaceName)
      )[0]
    );
    assert.equal(checkReverseEntry.parsed.entryName, entryName);
  });

  it("Set global reverse entry for token manager", async () => {
    const transaction = new web3.Transaction();
    await withSetGlobalReverseEntry(
      transaction,
      provider.connection,
      provider.wallet,
      {
        namespaceName,
        entryName,
        mintId: nameEntryMint,
      }
    );
    await executeTransaction(provider.connection, transaction, provider.wallet);

    const nameEntry = await getNameEntry(
      provider.connection,
      namespaceName,
      entryName
    );
    const [reverseEntryId] = await findDeprecatedReverseEntryId(
      provider.wallet.publicKey
    );
    expect(nameEntry.parsed.reverseEntry?.toString()).toEqual(
      reverseEntryId.toString()
    );
  });
});
