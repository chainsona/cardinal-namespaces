import { confirmTransactions } from "./confirm";

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
module.exports.handle = async (event: any) => {
  console.log(
    `--------------- Checking for unconfirmed transactions on ${new Date().toLocaleString()}  ---------------`
  );

  console.log(process.env, process.env.CONFIRM_TRANSACTIONS_DISABLED);
  if (process.env.CONFIRM_TRANSACTIONS_DISABLED === "true") {
    console.log("> Confirm transactions disabled");
  } else {
    await confirmTransactions();
  }

  console.log(
    `--------------- Finished checking for unconfirmed transactions on ${new Date().toLocaleString()}  ---------------`
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return event;
};
