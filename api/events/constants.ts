import { utils } from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";

export enum EventApproverKind {
  Wallet = "WALLET",
  Collection = "COLLECTION",
  Typeform = "TYPEFORM",
  None = "NONE",
}

export const EventApproverDescription: Record<EventApproverKind, string> = {
  [EventApproverKind.Wallet]: "1 NFT per Wallet address",
  [EventApproverKind.Collection]: "1 NFT per verified NFT held",
  [EventApproverKind.Typeform]: "1 NFT per Typeform response",
  [EventApproverKind.None]: "1 NFT per any request",
};

export const eventApproverKeys: Record<EventApproverKind, Keypair> = {
  [EventApproverKind.Wallet]: Keypair.fromSecretKey(
    utils.bytes.bs58.decode(
      process.env[`EVENT_APPROVER_${EventApproverKind.Wallet}`] ?? ""
    )
  ),
  [EventApproverKind.Collection]: Keypair.fromSecretKey(
    utils.bytes.bs58.decode(
      process.env[`EVENT_APPROVER_${EventApproverKind.Collection}`] ?? ""
    )
  ),
  [EventApproverKind.Typeform]: Keypair.fromSecretKey(
    utils.bytes.bs58.decode(
      process.env[`EVENT_APPROVER_${EventApproverKind.Typeform}`] ?? ""
    )
  ),
  [EventApproverKind.None]: Keypair.fromSecretKey(
    utils.bytes.bs58.decode(
      process.env[`EVENT_APPROVER_${EventApproverKind.None}`] ?? ""
    )
  ),
};
