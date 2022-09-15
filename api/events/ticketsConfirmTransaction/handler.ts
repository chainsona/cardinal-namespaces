import { confirmTransactions } from "./confirm";

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
module.exports.invalidate = async (event: any) => {
  console.log(
    `--------------- Checking for unconfirmed transactions on ${new Date().toLocaleString()}  ---------------`
  );

  await confirmTransactions();

  console.log(
    `--------------- Finished checking for unconfirmed transactions on ${new Date().toLocaleString()}  ---------------`
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return event;
};
