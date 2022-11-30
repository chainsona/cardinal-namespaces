import { AnchorProvider, utils, Wallet } from "@project-serum/anchor";
import { chaiSolana } from "@saberhq/chai-solana";
import { Connection, Keypair } from "@solana/web3.js";
import chai from "chai";

chai.use(chaiSolana);

export const keypairFrom = (s: string, n?: string): Keypair => {
  try {
    if (s.includes("[")) {
      return Keypair.fromSecretKey(
        Buffer.from(
          s
            .replace("[", "")
            .replace("]", "")
            .split(",")
            .map((c) => parseInt(c))
        )
      );
    } else {
      return Keypair.fromSecretKey(utils.bytes.bs58.decode(s));
    }
  } catch (e) {
    try {
      return Keypair.fromSecretKey(
        Buffer.from(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          JSON.parse(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires
            require("fs").readFileSync(s, {
              encoding: "utf-8",
            })
          )
        )
      );
    } catch (e) {
      process.stdout.write(`${n ?? "keypair"} is not valid keypair`);
      process.exit(1);
    }
  }
};

export const getProvider = (): AnchorProvider => {
  return new AnchorProvider(
    new Connection("http://127.0.0.1:8899", "confirmed"),
    new Wallet(keypairFrom("./tests/test-key.json")),
    {}
  );
};
