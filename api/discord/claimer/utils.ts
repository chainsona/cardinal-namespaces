/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { findAta } from "@cardinal/common";
import * as namespaces from "@cardinal/namespaces";
import * as splToken from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";

export const tryGetAta = async (
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey
): Promise<splToken.AccountInfo | undefined> => {
  try {
    const namespaceTokenAccountId = await findAta(mint, owner, true);
    const tokenMint = new splToken.Token(
      connection,
      mint,
      splToken.TOKEN_PROGRAM_ID,
      Keypair.generate()
    );
    return tokenMint.getAccountInfo(namespaceTokenAccountId);
  } catch (e) {
    console.log("Failed to get ata");
  }
};

export async function tryGetNameEntry(
  connection: Connection,
  namespaceName: string,
  entryName: string
) {
  try {
    const entry = await namespaces.getNameEntry(
      connection,
      namespaceName,
      entryName
    );
    return entry;
  } catch (e) {
    return null;
  }
}

export async function tryGetClaimRequest(
  connection: Connection,
  namespaceName: string,
  entryName: string,
  user: PublicKey
) {
  try {
    const entry = await namespaces.getClaimRequest(
      connection,
      namespaceName,
      entryName,
      user
    );
    return entry;
  } catch (e) {
    console.log("Failed to get claim request:", e);
    return null;
  }
}
