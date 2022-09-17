import {
  findAta,
  withFindOrInitAssociatedTokenAccount,
  withWrapSol,
} from "@cardinal/common";
import type { Wallet } from "@saberhq/solana-contrib";
import * as splToken from "@solana/spl-token";
import type { Connection } from "@solana/web3.js";
import { PublicKey, Transaction } from "@solana/web3.js";

export const FEE_COLLECTOR_SHARE = 0.05;
export const FEE_COLLECTOR_ADDRESS = new PublicKey(
  "cpmaMZyBQiPxpeuxNsQhW7N8z1o9yaNdLgiPhWGUEiX"
);
export const WRAPPED_SOL_ADDRESS =
  "So11111111111111111111111111111111111111112";

export const PAYMENT_MINTS_DECIMALS_MAPPING: { [key: string]: number } = {
  So11111111111111111111111111111111111111112: 9,
};

export const withHandlePayment = async (
  transaction: Transaction,
  connection: Connection,
  eventCreatorPublicKey: PublicKey,
  claimerWallet: Wallet,
  paymentMint: PublicKey,
  amountToPay: number,
  mintDecimals: number
): Promise<void> => {
  if (paymentMint.toString() === WRAPPED_SOL_ADDRESS && amountToPay > 0) {
    await withWrapSol(transaction, connection, claimerWallet, amountToPay);

    try {
      if (paymentMint.toString() !== WRAPPED_SOL_ADDRESS) {
        await findAta(paymentMint, claimerWallet.publicKey, true);
      }
    } catch (e) {
      throw "Claimer has no payment mint funds";
    }
    const claimerATA = await withFindOrInitAssociatedTokenAccount(
      new Transaction(),
      connection,
      paymentMint,
      claimerWallet.publicKey,
      claimerWallet.publicKey,
      true
    );

    const feeCollectorATA = await withFindOrInitAssociatedTokenAccount(
      transaction,
      connection,
      paymentMint,
      FEE_COLLECTOR_ADDRESS,
      claimerWallet.publicKey,
      true
    );

    const creatorATA = await withFindOrInitAssociatedTokenAccount(
      transaction,
      connection,
      paymentMint,
      new PublicKey(eventCreatorPublicKey),
      claimerWallet.publicKey,
      true
    );

    // creator amount
    const creatorAmount = amountToPay * (1 - FEE_COLLECTOR_SHARE);
    transaction.instructions.push(
      splToken.Token.createTransferCheckedInstruction(
        splToken.TOKEN_PROGRAM_ID,
        claimerATA,
        paymentMint,
        creatorATA,
        claimerWallet.publicKey,
        [],
        creatorAmount,
        mintDecimals
      )
    );

    // cardinal amount
    transaction.instructions.push(
      splToken.Token.createTransferCheckedInstruction(
        splToken.TOKEN_PROGRAM_ID,
        claimerATA,
        paymentMint,
        feeCollectorATA,
        claimerWallet.publicKey,
        [],
        amountToPay - creatorAmount,
        mintDecimals
      )
    );
  }
};
