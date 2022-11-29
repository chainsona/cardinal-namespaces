/* eslint-disable import/first */
import * as dotenv from "dotenv";

dotenv.config();

import { getNameEntry } from "../src";
import { connectionFor } from "./connection";

const getNameEntryData = async (cluster: string) => {
  const connection = connectionFor(cluster);
  const nameEntry = await getNameEntry(connection, "twitter", "cardinal_labs");
  console.log(JSON.stringify(nameEntry, null, 2));
};

getNameEntryData("mainnet").catch((e) => console.log(e));
