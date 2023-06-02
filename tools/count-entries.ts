/* eslint-disable import/first */
import * as dotenv from "dotenv";

dotenv.config();
import type { AccountData } from "@cardinal/common";
import * as anchor from "@project-serum/anchor";
import type * as web3 from "@solana/web3.js";

import type { ClaimRequestData, EntryData, ReverseEntryData } from "../src";
import { NAMESPACES_IDL, NAMESPACES_PROGRAM_ID } from "../src";
import { connectionFor } from "./connection";

export async function countEntries(connection: web3.Connection): Promise<void> {
  const coder = new anchor.BorshAccountsCoder(NAMESPACES_IDL);
  const programAccounts = await connection.getProgramAccounts(
    NAMESPACES_PROGRAM_ID
  );
  console.log(`Found ${programAccounts.length} accounts`);
  const namespaceEntries: AccountData<EntryData>[] = [];
  const claimRequests: AccountData<ClaimRequestData>[] = [];
  const reverseEntries: AccountData<ReverseEntryData>[] = [];
  programAccounts.forEach((account) => {
    try {
      const entryData = coder.decode<EntryData>("entry", account.account.data);
      namespaceEntries.push({
        ...account,
        parsed: entryData,
      });
    } catch (e) {
      // pass
    }
    try {
      const claimRequestData = coder.decode<ClaimRequestData>(
        "claimRequest",
        account.account.data
      );
      claimRequests.push({
        ...account,
        parsed: claimRequestData,
      });
    } catch (e) {
      // pass
    }
    try {
      const reverseEntryData = coder.decode<ReverseEntryData>(
        "reverseEntry",
        account.account.data
      );
      reverseEntries.push({
        ...account,
        parsed: reverseEntryData,
      });
    } catch (e) {
      // pass
    }
  });
  console.log(
    `Found (${namespaceEntries.length}) name entries (${claimRequests.length}) reverse entries and (${claimRequests.length}) claim requests`
  );
}

countEntries(connectionFor("mainnet")).catch((e) => console.log(e));
