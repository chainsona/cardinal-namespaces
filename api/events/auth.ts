import type { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

export const checkUserToken = (
  data: string,
  signedData: string | undefined,
  signer: PublicKey | undefined
) => {
  if (!signer) throw `Invalid user public key`;
  if (!signedData) throw `Auth token missing`;
  const signResult = nacl.sign.detached.verify(
    Buffer.from(data),
    Buffer.from(signedData, "base64"),
    signer.toBuffer()
  );
  console.log(signResult);
  if (!signResult) {
    throw `Invalid signature for key ${signer.toString()}`;
  }
};
