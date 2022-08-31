import { tryGetEventFromShortlink, tryGetEventTicketByName } from "../firebase";
import { eventIdFromTicket } from "./create-events";
import { ticketConfig } from "./ticketConfig";

export const getTicketConfigs = async () => {
  const results = await Promise.all(
    ticketConfig.map(async (t) => {
      const eventId = eventIdFromTicket(t);
      const eventData = await tryGetEventFromShortlink(eventId);
      const tryTicket = await tryGetEventTicketByName(
        eventData?.docId ?? "",
        t.ticketType
      );
      if (!tryTicket) {
        console.log("MISSING TICKET: ", t);
      }
      return { ...t, ticketId: tryTicket?.docId };
    })
  );
  console.log(results);
};

getTicketConfigs().catch((e) => console.log(e));
