import { getAllNamespaces } from "../src";
import { connectionFor } from "./connection";

export const getNamespaceData = async (clusterName: string) => {
  const connection = connectionFor(clusterName);
  const namespaces = await getAllNamespaces(connection);
  console.log(namespaces);
};

getNamespaceData("mainnet-beta")
  .then(() => {
    console.log("success");
  })
  .catch((e) => {
    console.log("Error:", e);
  });
