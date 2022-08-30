/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { initializeApp } from "firebase/app";
import type { DocumentReference, Firestore } from "firebase/firestore";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

export const checkUniqueEventShortLink = async (
  eventFirestore: Firestore,
  eventShortLink: string
): Promise<boolean> => {
  const eventsQuery = query(
    collection(eventFirestore, "events"),
    where("shortLink", "==", eventShortLink)
  );
  const eventsSnap = (await getDocs(eventsQuery)).docs;
  if (eventsSnap.length === 0) {
    return true;
  }
  return false;
};

export const getEventRef = (eventDocumentId?: string): DocumentReference => {
  if (eventDocumentId) {
    return doc(eventFirestore, "events", eventDocumentId);
  } else {
    return doc(collection(eventFirestore, "events"));
  }
};

export const getTicketRef = (
  eventDocumentId?: string,
  ticketDocumentId?: string
): DocumentReference => {
  if (ticketDocumentId) {
    return doc(eventFirestore, "tickets", ticketDocumentId);
  }

  if (!eventDocumentId) {
    throw "No event id passed in";
  }
  const generatedTicketId = `crd-${eventDocumentId}-${
    Math.floor(Math.random() * 90000) + 10000
  }`;
  return doc(eventFirestore, "tickets", generatedTicketId);
};

export const tryGetEventTicketByName = async (
  eventDocId: string,
  name: string
): Promise<FirebaseTicket | undefined> => {
  const ticketsQuery = query(
    collection(eventFirestore, "tickets"),
    where("eventId", "==", eventDocId),
    where("ticketName", "==", name)
  );
  const ticketsSnap = (await getDocs(ticketsQuery)).docs;
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
  const eventsQuery = query(
    collection(eventFirestore, "events"),
    where("shortLink", "==", eventShortLink)
  );
  const eventsSnap = (await getDocs(eventsQuery)).docs;
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
  const eventRef = doc(eventFirestore, "events", docId);
  const eventsSnap = await getDoc(eventRef);
  if (!eventsSnap.exists()) {
    return undefined;
  }
  return eventsSnap.data() as FirebaseEvent;
};

export const tryGetEventTicket = async (
  ticketDocId: string
): Promise<FirebaseTicket | undefined> => {
  const ticketRef = getTicketRef(undefined, ticketDocId);
  const ticketSnap = await getDoc(ticketRef);
  if (ticketSnap.exists()) {
    return ticketSnap.data() as FirebaseTicket;
  } else {
    return undefined;
  }
};

export type FirebaseEvent = {
  creatorId: string;
  docId: string;
  environment: string;
  eventDescription: string;
  eventEndTime: string;
  eventLocation: string;
  eventName: string;
  eventStartTime: string;
  shortLink: string;
  eventBannerImage: string;
  eventPaymentMint: string;
};

export type FirebaseTicket = {
  docId: string;
  eventId: string;
  ticketId: string;
  ticketName: string;
  ticketQuantity: string;
  ticketShortLink: string;
  ticketPrice: string;
  additionalSigners: string[];
};

export type EventData = {
  shortLink: string;
  eventName: string;
  eventLocation: string;
  eventDescription: string;
  eventStartTime: string;
  eventEndTime: string;
  creatorId: string;
  environment: string;
  eventBannerImage: string;
};

export type TicketCreationData = {
  docId: string;
  eventId: string;
  ticketShortLink: string;
  ticketName: string;
  ticketQuantity: string;
  ticketPrice: string;
  environment: string;
  creator: string;
  ticketImage: string;
  ticketMetadata: string;
};

export type ApproveData = {
  account: string;
  eventId: string;
  ticketId: string;
  email: string;
  amount: string;
  ticketName: string;
  companyId: string;
};

export type ClaimData = {
  account: string;
  ticketId: string;
  amount: string;
};

export type OtpClaimData = {
  account: string;
  ticketId: string;
  entryName: string;
  otp: string;
};
