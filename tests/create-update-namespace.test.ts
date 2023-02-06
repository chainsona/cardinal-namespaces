import {
  CardinalProvider,
  executeTransaction,
  getTestProvider,
} from "@cardinal/common";
import * as anchor from "@project-serum/anchor";
import * as web3 from "@solana/web3.js";
import assert from "assert";

import {
  getNamespaceByName,
  withCreateNamespace,
  withUpdateNamespace,
} from "../src";

describe("create-update-namespace", () => {
  // test params
  const namespaceName = `ns-${Math.random()}`;
  const paymentAmountDaily = new anchor.BN(0);

  // global
  let provider: CardinalProvider;
  beforeAll(async () => {
    provider = await getTestProvider();
  });

  it("Creates a namespace", async () => {
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
        transferableEntries: false,
        limit: 1,
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

  it("Updates a namespace", async () => {
    const transaction = new web3.Transaction();
    const namespace = await getNamespaceByName(
      provider.connection,
      namespaceName
    );
    await withUpdateNamespace(
      transaction,
      provider.connection,
      provider.wallet,
      namespaceName,
      {
        updateAuthority: provider.wallet.publicKey,
        rentAuthority: provider.wallet.publicKey,
        approveAuthority: provider.wallet.publicKey,
        transferableEntries: false,
        limit: 1,
        maxExpiration: new anchor.BN(10000),
        schema: namespace.parsed.schema,
        paymentAmountDaily: namespace.parsed.paymentAmountDaily,
        paymentMint: namespace.parsed.paymentMint,
        minRentalSeconds: namespace.parsed.minRentalSeconds,
        invalidationType: namespace.parsed.invalidationType,
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
    assert.equal(checkNamespace.parsed.maxExpiration?.toNumber(), 10000);
  });
});
