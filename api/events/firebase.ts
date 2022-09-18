import { utils } from "@project-serum/anchor";
import { SignerWallet } from "@saberhq/solana-contrib";
import { Keypair } from "@solana/web3.js";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { initializeApp } from "firebase-admin/app";
import type {
  DocumentReference,
  Timestamp,
  WriteBatch,
} from "firebase-admin/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCJgPBVSp2TokeX_UpydLf4M7yamYA0nhs",
  authDomain: "cardinal-events.firebaseapp.com",
  projectId: "cardinal-events",
  storageBucket: "cardinal-events.appspot.com",
  messagingSenderId: "453139651235",
  appId: "1:453139651235:web:67443d5b218b600e7f3d16",
  measurementId: "G-R9SVMD5CRT",
};

export const firebaseEventApp = initializeApp(firebaseConfig);
export const eventFirestore = getFirestore(firebaseEventApp);
export const eventStorage = getStorage(firebaseEventApp);

export const getWriteBatch = (): WriteBatch => eventFirestore.batch();

export const checkUniqueEventShortLink = async (
  eventShortLink: string
): Promise<boolean> => {
  const eventsQuery = eventFirestore
    .collection("events")
    .where("shortLink", "==", eventShortLink);
  const eventsSnap = (await eventsQuery.get()).docs;
  if (eventsSnap.length === 0) {
    return true;
  }
  return false;
};

export const getPayerRef = (payerDocumentId?: string): DocumentReference => {
  if (payerDocumentId) {
    return eventFirestore.doc(`payers/${payerDocumentId}`);
  } else {
    return eventFirestore.collection("payers").doc();
  }
};

export const getEventRef = (eventDocumentId?: string): DocumentReference => {
  if (eventDocumentId) {
    return eventFirestore.doc(`events/${eventDocumentId}`);
  } else {
    return eventFirestore.collection("events").doc();
  }
};

export const getApprovalRef = (docId?: string): DocumentReference => {
  if (docId) {
    return eventFirestore.doc(`approvals/${docId}`);
  } else {
    return eventFirestore.collection("approvals").doc();
  }
};

export const tryGetResponsesByApproval = async (
  approvalSignerPubkey: string
) => {
  const responsesQuery = eventFirestore
    .collection("responses")
    .where("approvalSignerPubkey", "==", approvalSignerPubkey);
  const eventsSnap = (await responsesQuery.get()).docs;
  return eventsSnap;
};

export const getTicketRef = (
  eventDocumentId?: string,
  ticketDocumentId?: string
): DocumentReference => {
  if (ticketDocumentId) {
    return eventFirestore.doc(`tickets/${ticketDocumentId}`);
  }

  if (!eventDocumentId) {
    throw "No event id passed in";
  }
  const generatedTicketId = `crd-${eventDocumentId}-${
    Math.floor(Math.random() * 90000) + 10000
  }`;
  return eventFirestore.doc(`tickets/${generatedTicketId}`);
};

export const getResponseRef = (resposneId?: string): DocumentReference => {
  if (resposneId) {
    return eventFirestore.doc(`responses/${resposneId}`);
  } else {
    return eventFirestore.collection("responses").doc();
  }
};

export const getResponseByApproval = async (approvalSignerPubkey: string) => {
  const responsesQuery = eventFirestore
    .collection("responses")
    .where("approvalSignerPubkey", "==", approvalSignerPubkey);
  const responsesSnap = (await responsesQuery.get()).docs;
  if (responsesSnap.length !== 1) {
    throw "Response approvalSignerKeypair not found";
  }
  return responsesSnap[0];
};

export const tryGetEventTicketByDocId = async (
  eventDocId: string,
  ticketDocId?: string
): Promise<FirebaseTicket | undefined> => {
  if (ticketDocId === undefined) {
    return undefined;
  }
  const ticketsQuery = eventFirestore
    .collection("tickets")
    .where("eventId", "==", eventDocId)
    .where("docId", "==", ticketDocId);
  const ticketsSnap = (await ticketsQuery.get()).docs;
  if (ticketsSnap.length === 0) {
    return undefined;
  } else if (ticketsSnap.length > 1) {
    throw `Ticket for event with ID ${eventDocId} with doc ID ${ticketDocId} already exists`;
  }
  return ticketsSnap[0]!.data() as FirebaseTicket;
};

export const tryGetEventTicketByName = async (
  eventDocId: string,
  name: string
): Promise<FirebaseTicket | undefined> => {
  const ticketsQuery = eventFirestore
    .collection("tickets")
    .where("eventId", "==", eventDocId)
    .where("ticketName", "==", name);
  const ticketsSnap = (await ticketsQuery.get()).docs;
  if (ticketsSnap.length === 0) {
    return undefined;
  } else if (ticketsSnap.length > 1) {
    throw `Ticket for event with ID ${eventDocId} with name ${name} already exists`;
  }
  return ticketsSnap[0]!.data() as FirebaseTicket;
};

export const tryGetEventFromShortlink = async (
  eventShortLink: string
): Promise<FirebaseEvent | undefined> => {
  const eventsQuery = eventFirestore
    .collection("events")
    .where("shortLink", "==", eventShortLink);
  const eventsSnap = (await eventsQuery.get()).docs;
  if (eventsSnap.length === 0) {
    return undefined;
  } else if (eventsSnap.length > 1) {
    throw "Cannot have two events with the same shrotlink";
  }
  return eventsSnap[0].data() as FirebaseEvent;
};

export const tryGetEvent = async (
  docId: string
): Promise<FirebaseEvent | undefined> => {
  const eventRef = eventFirestore.doc(`events/${docId}`);
  const eventsSnap = await eventRef.get();
  if (!eventsSnap.exists) {
    return undefined;
  }
  return eventsSnap.data() as FirebaseEvent;
};

export const getEvent = async (docId: string | null) => {
  if (!docId) throw "Event docId invalid";
  const checkEvent = await tryGetEvent(docId);
  if (!checkEvent) throw `Event with id ${docId} not found`;
  return checkEvent;
};

export const tryGetEventTicket = async (
  ticketDocId: string
): Promise<FirebaseTicket | undefined> => {
  const ticketRef = getTicketRef(undefined, ticketDocId);
  const ticketSnap = await ticketRef.get();
  if (ticketSnap.exists) {
    return ticketSnap.data() as FirebaseTicket;
  } else {
    return undefined;
  }
};

export const getTicket = async (docId: string | null) => {
  if (!docId) throw "Ticket docId invalid";
  const checkTicket = await tryGetEventTicket(docId);
  if (!checkTicket) throw `Ticket with id ${docId} not found`;
  return checkTicket;
};

export const tryGetPayer = async (
  docId: string
): Promise<FirebasePayer | undefined> => {
  const payerRef = getPayerRef(docId);
  const payerSnap = await payerRef.get();
  if (payerSnap.exists) {
    return payerSnap.data() as FirebasePayer;
  } else {
    return undefined;
  }
};

export const getPayerKeypair = async (docId: string) => {
  const checkPayer = await tryGetPayer(docId);
  if (!checkPayer?.secretKey) throw "Missing secret key";
  return new SignerWallet(
    Keypair.fromSecretKey(utils.bytes.bs58.decode(checkPayer?.secretKey))
  );
};

export const authFirebase = async () => {
  const auth = getAuth();
  const email = process.env.FIREBASE_ACCOUNT_EMAIL || "";
  const password = process.env.FIREBASE_ACCOUNT_PASSWORD || "";
  await signInWithEmailAndPassword(auth, email, password);
};

export const getEventBannerImage = (eventDocumentId: string) => {
  return `https://firebasestorage.googleapis.com/v0/b/cardinal-events.appspot.com/o/banners%2F${eventDocumentId}.png?alt=media`;
};

export type FirebaseEvent = {
  creatorId: string;
  docId: string;
  config: string | null;
  environment: string;
  eventDescription: string;
  eventEndTime: Timestamp | string;
  eventLocation: string;
  eventName: string;
  eventStartTime: Timestamp | string;
  shortLink: string;
  eventBannerImage: string | null;
  eventPaymentMint: string;
};

export type FirebaseTicket = {
  docId: string;
  eventId: string;
  ticketName: string;
  ticketDescription?: string;
  ticketQuantity: number;
  ticketShortLink: string;
  ticketPrice: number;
  additionalSigners?: string[];
  feePayer?: string;
};

export type FirebasePayer = {
  docId: string;
  name: string;
  publicKey: string;
  secretKey: string;
  authority: string;
};

export type FirebaseApprovalData = {
  type: "direct" | "email";
  value: string;
  entryName: string;
  approvalSignerPubkey: string;
} | null;

export type FirebaseApproval = {
  docId: string | null;
  responseId: string | null;
  secretKey: string | null;
  approvalData: FirebaseApprovalData | null;
};

export type FirebaseResponse = {
  eventId: string | null;
  ticketId: string | null;
  environment: string | null;
  timestamp: Timestamp | null;
  payerAddress: string | null;
  claimerAddress: string | null;
  ticketAmount: number | null;
  formResponse: FormResponse[] | null;
  payerTransactionId: string | null;
  payerSignerPubkey: string | null;
  approvalData: FirebaseApprovalData | null;
  approvalTransactionId: string | null;
  approvalSignerPubkey: string | null;
  claimTransactionId: string | null;
  claimSignerPubkey: string | null;
};

export type EventData = {
  config?: string | null;
  shortLink: string;
  eventName: string;
  eventLocation: string;
  eventDescription: string;
  eventStartTime: Timestamp | string;
  eventEndTime: Timestamp | string;
  creatorId: string;
  environment: string;
  eventBannerImage: string | null;
  eventQuestions?: string[];
};

export type TicketCreationData = {
  docId?: string;
  eventId: string;
  ticketShortLink: string;
  ticketName: string;
  ticketQuantity: string;
  ticketPrice: string;
  ticketDescription?: string;
  environment: string;
  creator: string;
  ticketImage: string;
  ticketMetadata: string;
  feePayer?: string;
  additionalSigners?: string[];
};

export type ApproveData = {
  account: string;
  eventId: string;
  ticketId: string;
  email: string;
  amount: string;
};

export type FormResponse = { question: string; answer: string };

export type ClaimData = {
  account: string;
  ticketId: string;
  amount: string;
  formResponse?: FormResponse[];
};

export type OtpClaimData = {
  account: string;
  ticketId: string;
  entryName?: string;
  tokenManagerId?: string;
  otp: string;
};

export type ClaimResponseData = {
  account: string;
  eventId: string;
  amount: number;
  formResponse?: FormResponse[];
};

export type UpdateResponseData = {
  transactionDocumentIds: string[];
  transactionIds: string[];
  updateSignerPrivateKey: string;
};
