import { findAta, tryGetAccount } from "@cardinal/common";
import { DEFAULT_PAYMENT_MANAGER_NAME } from "@cardinal/token-manager/dist/cjs/programs/paymentManager";
import { getPaymentManager } from "@cardinal/token-manager/dist/cjs/programs/paymentManager/accounts";
import { init } from "@cardinal/token-manager/dist/cjs/programs/paymentManager/instruction";
import { findPaymentManagerAddress } from "@cardinal/token-manager/dist/cjs/programs/paymentManager/pda";
import * as anchor from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@project-serum/anchor/dist/cjs/utils/token";
import { expectTXTable } from "@saberhq/chai-solana";
import { SolanaProvider, TransactionEnvelope } from "@saberhq/solana-contrib";
import * as splToken from "@solana/spl-token";
import * as web3 from "@solana/web3.js";
import assert from "assert";
import { expect } from "chai";

import {
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
  withSetNamespaceReverseEntry,
  withUpdateClaimRequest,
} from "../src";
import { createMint } from "./utils";
import { getProvider } from "./workspace";

describe("create-claim-expire-name-entry", () => {
  const provider = getProvider();

  // test params
  const namespaceName = `ns-${Math.random()}`;
  const entryName = `testname-${Math.random()}`;
  const mintKeypair = web3.Keypair.generate();
  const nameEntryMint = mintKeypair.publicKey;
  const mintAuthority = web3.Keypair.generate();
  const invalidator = web3.Keypair.generate();
  const paymentAmountDaily = new anchor.BN(10000000);
  const PAYMENT_MINT_START = 100000000;
  const duration = 86400;

  const MAKER_FEE = 500;
  const TAKER_FEE = 300;
  const feeCollector = web3.Keypair.generate();

  // global
  let paymentMint: splToken.Token;

  it("Creates a namespace", async () => {
    [, paymentMint] = await createMint(
      provider.connection,
      mintAuthority,
      provider.wallet.publicKey,
      PAYMENT_MINT_START
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
        paymentMint: paymentMint.publicKey,
        transferableEntries: false,
        maxExpiration: new anchor.BN(Date.now() / 1000 + 2 * 86400),
      }
    );

    await expectTXTable(
      new TransactionEnvelope(
        SolanaProvider.init(provider),
        transaction.instructions
      ),
      "before",
      {
        verbosity: "error",
        formatLogs: true,
      }
    ).to.be.fulfilled;

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

  it("Create payment manager", async () => {
    const provider = getProvider();
    const transaction = new web3.Transaction();

    const [ix] = await init(
      provider.connection,
      provider.wallet,
      DEFAULT_PAYMENT_MANAGER_NAME,
      {
        feeCollector: feeCollector.publicKey,
        makerFeeBasisPoints: MAKER_FEE,
        takerFeeBasisPoints: TAKER_FEE,
      }
    );

    transaction.add(ix);
    const txEnvelope = new TransactionEnvelope(
      SolanaProvider.init({
        connection: provider.connection,
        wallet: provider.wallet,
        opts: provider.opts,
      }),
      [...transaction.instructions]
    );
    await expectTXTable(txEnvelope, "Create Payment Manager", {
      verbosity: "error",
      formatLogs: true,
    }).to.be.fulfilled;

    const [checkPaymentManagerId] = await findPaymentManagerAddress(
      DEFAULT_PAYMENT_MANAGER_NAME
    );
    const paymentManagerData = await getPaymentManager(
      provider.connection,
      checkPaymentManagerId
    );
    expect(paymentManagerData.parsed.name).to.eq(DEFAULT_PAYMENT_MANAGER_NAME);
    expect(paymentManagerData.parsed.makerFeeBasisPoints).to.eq(MAKER_FEE);
    expect(paymentManagerData.parsed.takerFeeBasisPoints).to.eq(TAKER_FEE);
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
    await expectTXTable(
      new TransactionEnvelope(
        SolanaProvider.init(provider),
        transaction.instructions,
        [mintKeypair]
      ),
      "before",
      {
        verbosity: "error",
        formatLogs: true,
      }
    ).to.be.fulfilled;

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

    await expectTXTable(
      new TransactionEnvelope(
        SolanaProvider.init(provider),
        transaction.instructions
      ),
      "before",
      {
        verbosity: "error",
        formatLogs: true,
      }
    ).to.be.fulfilled;
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
    await expectTXTable(
      new TransactionEnvelope(
        SolanaProvider.init(provider),
        transaction.instructions
      ),
      "before",
      {
        verbosity: "error",
        formatLogs: true,
      }
    ).to.be.fulfilled;
  });

  it("Claim", async () => {
    const transaction = new web3.Transaction();
    await withClaimNameEntry(
      transaction,
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      nameEntryMint,
      duration
    );
    await withSetNamespaceReverseEntry(
      transaction,
      provider.connection,
      provider.wallet,
      namespaceName,
      entryName,
      nameEntryMint
    );
    await expectTXTable(
      new TransactionEnvelope(
        SolanaProvider.init(provider),
        transaction.instructions
      ),
      "before",
      {
        verbosity: "error",
        formatLogs: true,
      }
    ).to.be.fulfilled;

    const checkClaimRequest = await tryGetAccount(async () =>
      getClaimRequest(
        provider.connection,
        namespaceName,
        entryName,
        provider.wallet.publicKey
      )
    );
    expect(checkClaimRequest).to.eq(null);

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

    const checkRecipientTokenAccount = await new splToken.Token(
      provider.connection,
      nameEntryMint,
      TOKEN_PROGRAM_ID,
      web3.Keypair.generate()
    ).getAccountInfo(await findAta(nameEntryMint, provider.wallet.publicKey));
    expect(checkRecipientTokenAccount.amount.toNumber()).to.eq(1);
    expect(checkRecipientTokenAccount.isFrozen).to.eq(true);

    const checkReverseEntry = await getReverseNameEntryForNamespace(
      provider.connection,
      provider.wallet.publicKey,
      (
        await findNamespaceId(namespaceName)
      )[0]
    );
    assert.equal(checkReverseEntry.parsed.entryName, entryName);
  });
});
