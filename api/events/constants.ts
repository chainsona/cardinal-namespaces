import { PublicKey } from "@solana/web3.js";

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

export const eventApproverKeys: Record<
  EventApproverKind,
  { publicKey: PublicKey; secretKey: string }
> = {
  [EventApproverKind.Wallet]: {
    publicKey: new PublicKey("ek1QPLkV1iEYwJxM6xcu7gniemL5xbAGKZRECxcg5Tb"),
    secretKey: `EVENT_APPROVER_${EventApproverKind.Wallet}`,
  },
  [EventApproverKind.Collection]: {
    publicKey: new PublicKey("ek2Y2SQ9Rvvn69Cberhv9Kg6PHqEkGq8xEjw32k9A16"),
    secretKey: `EVENT_APPROVER_${EventApproverKind.Collection}`,
  },
  [EventApproverKind.Typeform]: {
    publicKey: new PublicKey("ek31sTZHeAdWYzJWLsT1XufLvRnYVTACwuPt5HaAUu8"),
    secretKey: `EVENT_APPROVER_${EventApproverKind.Typeform}`,
  },
  [EventApproverKind.None]: {
    publicKey: new PublicKey("ek45HWhMg6szkrsB3va3JvU6Ki4rUvwtTZVUQUQdaaX"),
    secretKey: `EVENT_APPROVER_${EventApproverKind.None}`,
  },
};
