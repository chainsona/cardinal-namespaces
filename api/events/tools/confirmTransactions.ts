import * as dotenv from "dotenv";

dotenv.config();

// eslint-disable-next-line import/first
import { confirmTransactions } from "../ticketsConfirmTransaction/confirm";

confirmTransactions().catch((e) => console.log(e));
