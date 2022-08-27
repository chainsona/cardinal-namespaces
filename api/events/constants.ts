import { PublicKey } from "@solana/web3.js";

export enum EventApproverKind {
  Wallet = 1,
  Collection = 2,
  Typeform = 3,
  None = 4,
}

export const EventApproverDescription: Record<EventApproverKind, string> = {
  [EventApproverKind.Wallet]: "1 NFT per Wallet address",
  [EventApproverKind.Collection]: "1 NFT per verified NFT held",
  [EventApproverKind.Typeform]: "1 NFT per Typeform response",
  [EventApproverKind.None]: "1 NFT per any request",
};

export const EventApproverKeys: Record<EventApproverKind, PublicKey> = {
  [EventApproverKind.Wallet]: new PublicKey(
    "eap1dVePRmyBxhYp8sJUm62SxbfQN8dEHFNnRkN3t2g"
  ),
  [EventApproverKind.Collection]: new PublicKey(
    "eap2BwtSbGnNK9HtKUBCQAMhmv5Dw9qgY4trLNjjmMB"
  ),
  [EventApproverKind.Typeform]: new PublicKey(
    "eap3ydCVxs2QTyFpkfUyTWuhod3WC4XbovcLMhN3c3w"
  ),
  [EventApproverKind.None]: new PublicKey(
    "eap4pH6heQa5qM4bKYPi7YnbhdmJXWbYmYLZWcnVPv9"
  ),
};
