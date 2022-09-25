/* eslint-disable simple-import-sort/imports, import/first */
import * as dotenv from "dotenv";

dotenv.config();

import { BorshInstructionCoder, utils } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import type { FirebaseApproval, FirebaseResponse } from "../firebase";
import {
  eventFirestore,
  getTicket,
  tryGetEventFromShortlink,
} from "../firebase";
import { connectionFor } from "./connection";
import { TOKEN_MANAGER_IDL } from "@cardinal/token-manager/dist/cjs/programs/tokenManager";
import { reminderSuccessfulEmail } from "../email";
import * as postmark from "postmark";

const wallet = Keypair.fromSecretKey(
  utils.bytes.bs58.decode(process.env.AIRDROP_WALLET || "")
);

export const claimApproverToMint = async (
  cluster = "devnet",
  eventShortLink = "solana-spaces-unveiling",
  payer = "spce4Vksnb7szvEZLEgCQpmgkiy4ZgmN9eNWifJVVtA"
) => {
  const connection = connectionFor(cluster);
  const event = await tryGetEventFromShortlink(eventShortLink);
  if (!event) throw "Invalid event";

  const signatures = await connection.getSignaturesForAddress(
    new PublicKey(payer),
    undefined,
    "finalized"
  );
  const signaturesData = signatures.map((signature) => signature.signature);
  const coder = new BorshInstructionCoder(TOKEN_MANAGER_IDL);
  const claimApproverToMint = {};

  for (let i = 0; i < signaturesData.length; i++) {
    try {
      const signature = signaturesData[i];
      const parsedSignature = await connection.getParsedTransaction(
        signature,
        "finalized"
      );

      if (!parsedSignature) {
        throw "Couldn't find signature";
      }

      const signatureLength =
        parsedSignature.transaction?.message?.instructions?.length ?? 0;
      if (signatureLength === 8) {
        const masterEditionMint = (
          parsedSignature?.transaction.message.instructions[2] as {
            accounts: PublicKey[];
          }
        ).accounts[2].toString();

        const ix = parsedSignature?.transaction.message.instructions[3] as {
          data: string;
        };
        const ixData = ix.data;
        const pubkey = coder.decode(ixData, "base58");
        if (!pubkey) {
          return;
        }
        const parsedPubkeyData = pubkey.data as { claimApprover: PublicKey };
        const claimApproverKey = parsedPubkeyData.claimApprover.toString();
        claimApproverToMint[claimApproverKey] = masterEditionMint;
        console.log(claimApproverKey, masterEditionMint);
      }
    } catch (e) {
      console.log(e, signaturesData[i]);
    }
  }

  console.log(claimApproverToMint);
};

const claimApproverToMintData = {
  "7DwLxjcdhLiATLWNGNsJmH1KrY6tYfTWBLkpY6Yk7seZ":
    "D6uAm4rbKJVzXQpBHd5yn8DagW6UhjtXzrEZy7crqwVb",
  "8zAC5xPU3ZevcEWVz7vQqh4tqZwkof2a2BRZzCJnAmQK":
    "8k267vTdzF5couzRisFHDv7yaDnNAJxWYVf3bQCqVBvc",
  "76y2jgeUWGuJW5AXJYtPPWQtMkgv4m94tCd5t1Le8b5u":
    "42hcE8rjMvh3vXia8UN1Dkjb7BDvDT6Rj58YoksX6FFN",
  DRDiAjdkrd8kmR1xB3f9zKA4ZeZ9MkrZupiEX1ayM64a:
    "9BvXjk8STt3pzYcQQHiMS66JuXzVHsZQucdZ6TisBAfA",
  BHiceXEWCqqG57esxMrS3ahi5bd19yVWWxNiAPsHagLS:
    "4ixX1pPCfoqqDtrmUWY2TbW9hvyxpuquw5awCGSZCTg9",
  "2JoVFvyDBGxtcCCFQP7VhUHWoucF9wEzajE8N1nzJbW4":
    "HdQVxvkXazRDj8GPVyvUNqgdJGMtnqrN2i9nY8UTUXQo",
  AueVfWMLK3kCziPZUGxa5yvkJtMb7GLm62ihjKRLW1Eb:
    "HVqTAxfMXMc2mSrkMyzn2NesR1h2BbTfFn6jaVq7UeUD",
  BThMoT3pYhkKTobtub7rJ9xZuFgNdHtzFMi33UR1x3R9:
    "BC27ErstF2kSenCj4AMibtvFNmNgqrm3feVX7hRVSppi",
  "7SPVHLJSuNHxpbF9Xt9z3dH6LFwkrqCTiGor82ojqu6a":
    "49WniqnYsStMNAuvrQXzBwDNzywVfeMyXxM4J4zFUu1A",
  CUjAAyhYUEajm5VPm766n7X6czDYCAVietuXSMCFU3jz:
    "5mbpritF3KFSVFxfeArBhkC7Hv7FaYberXc6vzUkBu3G",
  ANF5vkCn3TwRYd3EW4i5xATzV7Jca274r7sxWA98LtGP:
    "GjSW7Z6z4xvMvrxsZEWyALzcPxD3jkRMX9oK3uztMRb8",
  EWHPWFrmjSQLqU7JL9XQhvGbf5Go4qHEpRJx3t1vMFqe:
    "3Us2JoM9uCWD484YMnun39W19aBQcgXVEnyE7dc63fhi",
  "32RHfgC1kkffYQGLx2qEQG7jrhXRZeKGVen3Vw273exY":
    "F7TeKxB3TRsrWWmnLirxy8kx3fpwCrfHVcLeJmmBRcD4",
  "5q3HAEP7TShLXRNb6F7QEjibR15UdcEusYW4oKM7Ls9v":
    "DpvswAREw2ZWxkw3bTTFx96BGwUmeHi5MbN9ncFGyyAW",
  "2eXsvrSt81kPU4bhGHA2xjnpiDWqqGz8VQLXYZjBtVoP":
    "GSUTK4Pb6X5YjX4zAZYWRDg5rbC3TEdBX49uyXnU3U8T",
  HdjT6rJ4Doyveo3fFdp6d6FAm6Fnb9KrDoM9pQJ9aZ8g:
    "AomJFuaFoRYxrmgbuA7dC5cnv8JvMuEBkGXbCYcQF5WL",
  "3BfPypFBiunVfSsPcNuGBjta8fNZySJkjFHVFwgqTm2o":
    "EsjHabaY2pUZaLUXjcCSomiGedaXetZ9qr6XJQpjcyLy",
  "8zNwFJKoy5BfNECyszYbPoEG4kYrKLxF2Vr7uHN6F4N4":
    "4sonp6KLbKBqDnqdRXsxLorkeQ37tFP7PPXuTn7U4Jcx",
  DAJb1djmS6ktGjKHokjjNgGmqHJEucBoP811DpJoTgoY:
    "G8z5RRSEfvgjYhms2cDqN8gYw5PicksrjKV7BAAogAKi",
  cNaDBzNa8LhpczmKSLABMB3gx5g3XXD8NKn64ek91Y2:
    "9TZakG83MqDEgwS45XGyKERAZHSJkSyQMnbzoPn9qQRF",
  CAV5g8wBCCoSSJ5PAs5w1YBb5nBQohvaPNXSbvK9qco6:
    "GghAfdDQJocHCMPT7DQ9rxYbPmeZEAwaZPLoNgYJYxy9",
  CW68yXNkgt4vvmJRcUKTycEhCGMyvcLEZtbU7BovotaJ:
    "2p5f4LQ3Y7CA646EeuDEFWG9pHmFzJwMmy897tkyCqjm",
  "5tjQsACsDFmYUarcaWwT71JS72ogAJCT2BaAzMsujKWs":
    "EMuaUcbWWT7GQuxT1P8E258j6g2YAjJSN9arjvRQ2UUz",
  "77A7mF6c1oZW1VH5qLbCAavXe3CvM5o75Rx9nWx4Zp3L":
    "FZGH8PR65mJ1zhW7ev9fPymS1A7HS9YtwF2L7ib4PjXD",
  HFke3ttCP8gsc2K45Yzy7iBjeVjpKUER8s5BH5DtfVH1:
    "GUHW9CdGiZYhJxtvNUgySiBEKKDb7nzU2L5U3owBFXyG",
  EKRLf2hiTjLXqCQBb8vwJmguXovh2pnsx2H6kAvfPJeF:
    "DocRSij5X9Gb3UgDAVb5sypuWpHq59b3xrMRwahkGPsL",
  dM8vFDtHTKkMguqdDr3fcfzjcdiEYFRRhKVPaexrwqn:
    "6Ga1Yun9MuV4U6F14mx5e3S9R9jJfKXYS2U4v4RYkjho",
  FXFs2X7tTDKJnriJscigdarTVnTibHP7ENRXqwgNMZC3:
    "Fqyx2D4dWF9RgcaDxig2Lh87YirLhkutRcXK6m7StT4E",
  "28ZJLzebnVxMncCL91LDLBUpwYGaBfGcDvTSjEfbWrxX":
    "5yfHCHxgUVYQaAod8AnPYJw4MScfWvUdTukux98zZ7Fx",
  E8iGYF8zQiiE4qeCtTdpV6cxfY3dJo6FfbGo3USk8LmQ:
    "23K9U1MyxN9v3zTjYHH9Rj9cKoGPYZevLBcCU9BVuYBw",
  "5esyaFmSjCVTKiD8YzWo2evt4q2onxS2g79pyeazexn4":
    "G5UJxKvfZQwuFkG9Jv8cb7R3XoPhT5T7JDg6ccFJESMe",
  BDJXSWSpD8MM7FwxweAMFGk7See94YXHZpLXK1wNJLqa:
    "2Ava9bcU9SsaqHDnMbzKePBEu9HMf8wkoV8eD66qZzW2",
  "5PWCkLyFFYWrQ7GATrpUo8GyC2aarPSV38Vs7m32sKjW":
    "9Ar2Bg5pf4GsutqbdWBYL1Zy4P8BUPZXHXQpVRD1iFqG",
  "38w3ckWXZJZ1XyJXZrHBmNecVQvtajwss5Skauzppb5y":
    "E4hWu3EyG4v2LswxNrtqwe3HiNBwUM9esMXRz2CRsqTV",
  "8EEdwghQDRmkxtm653ACm5PZa5cds3oBp3h2sne6zzsc":
    "EqWep3Tz7jMKACDKTT7KhbXB4biNtUetQsrk1jfgjXhm",
  "3rt9EAc7qf7vF6fYHUHG46VEeDnddApAXRvH6Pkpqhvp":
    "6EZkWiGKHjdqjSwinR9p65pzLj2hYG39sYyVCqEKoJAw",
  G6NihF82BY8Mi2DjQ2jrmV1cySmTabNf8kXjugkPv5EA:
    "4CtUHCt8t6ftGPcATdDzKZKpX6xVgt81ZxRoJEsDzAzH",
  "91kC4XDvF9Exm1YXLBZmd9RUkz3hDUtury2WDFakiowv":
    "91dgKEzhDJgC7DuHhszTdgJpAfbRfe4rH3j2YGfHX9nu",
  "9mJ5NogGDNRHzY258Ub12WDUoXWJ7rtzFxhV7cgwe9kj":
    "DQsjwrfHCZreRhmbaBQX4hQTZHyZikEnXz3vFaKHeVjD",
  "47yoSyNY8C7rC3kSNm1zUNgQbPHSwXtUrwfQG4zSSEvL":
    "DQs1c3BD7oh3qh8a6e3BEBiHnLA3xSMiRyZFph844nLz",
  "8H615VvK5jpkT5iX6th73Gaia5MeiSzXz6D6YLKxptD6":
    "6N2UPKAgakDGereovCzUpbitA2iisfMa6Vw8NQBMuBa4",
  EwkNvCsvvJScCfZpjATwuVbudbExNqCTxyYhdrfvctqi:
    "5vM7xSUDR4s4VhbTYs3EiYR8iiq3ZuiwfJF4CeethqS9",
  "6J1GBBiXpufaVh73c58BMMqmgFFBFY5AH5PVJywmbWsZ":
    "J6FwsT6UJPN3b1Ck81ixjpBy29dL28bQ7pdvMNV5hLyg",
  "3g9iwthL4cdN8xM626T27dLzkud1Z7Ptw6bWY9esjNNW":
    "VnnkR1zmS4mAPdaerxAEwdToUoYXZ6k8oXXyh8hDM79",
  CvWb47sPHRnpxEooByNEVHKVqicSYJZ29zazoKYYMLBw:
    "H72zPga5ho8c9n3jJoRwVu2PdP2quidLdmz5haXFP3Sq",
  "3V7sj6rAwUcAkGMYwahfZq9JksEPZoJUsN1nYT2eXnCU":
    "HRExduizMS8NntioRCmk6vopnFZpNTKHNWAv5vrsVhWt",
  HNVnyHf99GMYzse6vvXUbKJ4o1ngEkosXpHpXq8LAmLk:
    "BUNfFopnhApUexkiWhEaJTfYAJYPXrbZA9WKsmN8XWCy",
  "6hoYv7pNemdV7mFxCi9Qw7QV7qD6Y6uP49HWZac1m7Ps":
    "34wfefm7Yk222qTpS5WtAEHxUUVxuH6AMaUJ8fbnxRdL",
  F1VJMu6EmMewLHXygsQdPCPxyd9Wi1AJ1wRAUw7ypBH5:
    "934a8uymTyCSgjForzkEtKpWUwPaBZMxcgGYtox2man9",
  EatShjvK4s7ieqz7wr9HgHwTeerrGjxKDQye3H5t8RWo:
    "8nu3N316kFjoFHJY8EGXQqG9FY4UVqjeTaD6ivZJwqsQ",
  "2hBfqv5iox2Ai5J6b69NYcXHYJHWTCpVBk1AnZ6LPowo":
    "D5QCuK5uc88tLL7U9zmCN8GvE8iGYAAvFEQBCN29nHHg",
  "5mh8TpyekoqHmEFbRhfiNc3iPt8BbJitfXVYrGEWqyCm":
    "AKjb9vebp7hSv9qNdhqFVrcDeWHSupgoNpmWBWRypT3j",
  CvUNJNV296HGmUrKzqVpgT1FyGnDYqiADT486BCRvJn4:
    "G41guNxYbob4q2LzGF17W4AqMyYjAFo3N1QQ1YjmCeBK",
  CLvupcicy5CFfKrZ5qXT6BEX9gQkMWvEErjCMHcE319p:
    "4nmXf2nSWiyTVmDqhhbydnoHzTKsdAwMfvKAjqGUjowM",
  Fpe4bNQpqYkQNCxWR6j1x6efsknZK97PMSz7YxSUSMmM:
    "CrJmCM2UV8CBr7EahdFupDWggBStVtnWwXYk54CCVypz",
  "8sGvbq8cPLY6w2GvtbdvCmvWeaB5GyL5GkktWFLURLzB":
    "99XP66f7rwbeWc8fsTR1tcK9t9U3EGrUPm4j9rHyb18d",
  FJf8eXBwErhYXPZzB1NsdHTv3tFzQqpxvXZ7Js9VirMY:
    "Hy9398pa7mDnEkiZ73inkTdxwpCUtqpAY79hw5S5ibvf",
  Ho1HeRjM71JJVAh84UCGGUQKSZQNsfC2zER9dybvp3ko:
    "F64zTR36XwTsaXz7ibaZpaJFb7Uy71A6hvZsf5q2i1Pf",
  "3QUjziagbuBUpJenKHr9NRgC3YnKdwyZgzuxZGFjCJLL":
    "Aa3PKzrwf6erSwKdxT7PhxLdCxEf1momKNx3YGFFPWr8",
  "96Z5vsCC2mLKREx3GE75bdvmV4E4aSCx9EZYEiLm7APS":
    "7owd1NpNRE6p75X7vVs1TvMyyvaXmefv8Dcq4UHdJiB2",
  N4RnrnHQbAs3NUVSkFfGCGUop24mvP4sxEjg1qTMkvf:
    "8iEHgGBixGAdbpcMnwTdRwDR5XURYjTZfE2xoDzChY1h",
  "44zwA9tAf4RP34m16rQvFsLPq5Bj7UYpeRAwtQP97J4E":
    "414YwFC3dRsxAWvPhdCx8HueyyuP9Z9vFovQy7pArrPs",
  "7mHxzfoDfqfo5YpBqVWaaeuJrMx1Ny96EodZdqnAY6xb":
    "9753Dyke7hwq7PnpXYZQU9pNdvMT4DGuRPLEd6f2ooSt",
  Eg2oEDWVsHtcrAZ6T4Gjtpi89TCr19xBS1SRVrWmDLh6:
    "HUVQjqtbtpEXdHx1kXKNrRdmH3iVi6hMM4J5G9mA4HTw",
  BVzP1ez5brjbThpVXFBJLCazgrdbZbDsiKgB8jUFsnm9:
    "BbeE5cUCbEUbB4AVr2F2j5u9TA76bt6LENZ15Y31aHgG",
  "4ZntHaSxn9MsBHVz8mdspn1JbxQmZkbFaLiiCGnnxhr2":
    "9SoFR7ngr7udE6U8CXumQBN1Rur5wShWaQ4KsNW6cL7q",
  Da4VMCCYFoAMNh65AWMBikAxMyupZ7eDz2t46TvkZkbV:
    "8CAcXkc5kpnQFBPWWJBVmfsSpY2FvxgmvZJ5GPdkZtc9",
  HBJhYQ25yLs9H8ezMsMEQb6Mm9wwmwnyMqsVuL6Jdnju:
    "ByT6jjYMJ8oyrm8EzeVfJGBApecfGnhqY1Ec5cH4w1r4",
  H6FHy9LegBpMrxvYzR3swkHMu73WQv49heEYAxdv66jG:
    "Di7tvnGiZet4VJYu8DHZrqRVunEkc8ba6f7xQyh72WXh",
  "8oP6RDAS71NRFx5TqBUcD7vPBxWv5tBL6YseQToRLPSi":
    "HAnX1rgdSbQkXNcc1NLZnFqWubNUVVUBkSnzpAaR1Cb3",
  BAWJ5TYcLbS8vWnHuLLiZWDUstXy9wCkZsKrvzGR76A4:
    "7TxBxYCw1ieyAitTFWCTPvdZL3HicDauJ2mbcP82jQkr",
  "4NKZSdt9jWS76um9wNT9PfQxiM9vBSxxqD4L6P2uKPge":
    "DZ1VXpWWMrnmZxAwMGs4KUDkntFza9tjogU52bSHD1cA",
  B7Kb3NUtkwUAJW9Wgrs4JUGrmWFY53V4aHL2LJaidtSD:
    "2CXzocWcxMpT9RPu2UTrM7jgK48LQj2AHQ7RJDkd5hhw",
  AEcv1L3YW8WDPn5tpcoiHxio9FJLkkCYJZ64ygGUtHHv:
    "7ydTrhHYZ2gLEL2jv1TYRKHB8GwBYPfcmWC93KSnuZwT",
  EB8Q7gWikXeZtYvTc6EUCRRMSQgsvEngWP4YB5bZu3NV:
    "9yoC6ENZLq44E541aR3euLjyVJbvVuSqc7bjFCAV7E3E",
  BUXtpmHCFCLMHkfAeofq2teek386hWJw5PsKzfkEUW5E:
    "DgrvKCzgPTWNHGCU4187n8pTZvKH8qJpXRacrx2BMuyW",
  GWyVksAvc5Z9SevZaGwwEC6KKWfdysFyt25uKdS3yJFM:
    "A6F8WZjKUwvc2CKFhnMggC2tdxeC6t4V2Hc1xNjVPzJF",
  CL5z3qf1JxDY5RZRb9bJHQ6AW8A3BS34UMiQo2nxr9Ey:
    "5mrE7qhGDZfPvBZ4WrHXisw69ZopGKfkFD3ReA8m5W6J",
  AKtSzoHMGwkBLC24TvwFH99sQTbZFGTUVAuW4E4XXFFz:
    "9a6QkCh7uDP9gW1fmVPUUQdeT3XP9WddonSULXYEZBCx",
  DY6fQ5WYRMdANbTw56uKNVAvVvRjkH8spyzageWFeKA5:
    "AF4rDcMkCxdXPjycxW7NgQ9ud4D2WmwXxzFt2j2HkXYZ",
  CTNFtPTt2iH4m9HPs6K5ofN58zZsC8ZHnbj2Wtsc7HyX:
    "6QLM14BZ6D3cJcMN8qMJ1Y83SJhoviCMRKE5y7wgkeYo",
  "43J8SiTMCzHgWzxiYDGaihgHbPhPzRNTjogJETr3X8t6":
    "CLZX8mZXE9n4VtVyRefPBzbYAGKaicqTqNA67GxT2zsC",
  "36wzeJ6jkw7zGAccVEM8dWyt1ZfHqj8h85LX2xLzDVve":
    "BGksfZHzAhRfPuzXwn2ZtAxfL9vsZc7G7hGsHJppDhBR",
  "3erQPBbpcFjeu9uDawdCXGjFppQCRmarr19am5H9WZF3":
    "D5V4bfSq3x2JBB5q3cLWD3EBBEoQBaF6f9M9c9ixrde3",
  EwYUHH9cDE7YPtHGBH1RB1CMc2StMJayF3VqYKjCXGCi:
    "3TGZXSAFEwCn9AHKARWmR5sSAbP9fMLUQV7D6uAURAXy",
  HVeagptRCMHkXosXgNZiyWrUVd6C15yyTup9d1mXHGyA:
    "AhmBuN2MS55uNVB8rnzf64h1aCze2K8M98BwBimoFoWD",
  DX6WJ74MyA7TGVdMUhhaixBec39dkvtBZJoccKyGuiF2:
    "4hoDhf6TvDVV5qZ6dJxtPUryN44GvR9Sz5F2iHcjERXY",
  "3uFMgNHdgL5TZnLqXxp266kiXCfBQDK9MXFuSorrhHeS":
    "6iCXviLTwFnCmPkWDLv3ro6BW2UJk4g4751BPg15Qas2",
  CXQHBovFupfLsgB7eNcvsHH33qKhcup3S9VtXza4HGVT:
    "EQFk2uZb6Cdc9RBnTAz39TVtb9zZxTTZuqSZAbbGoJ18",
  Ar2VcQ9vh5bcN6pxNdRJeY5dxh4H3GUVcHxDuzdMKJgY:
    "APE8PhMgC9TP3omySFBo4pMUhxYSabCYa34zniHjBfQN",
  HZgfp2sazezwhpL5zQzSuGfKmK5xVhTJVFmrUJunchFB:
    "6CSmnjhjkmFQ7XrZXn3jaKCmPb2KYJhFcFZGfsE8fsLX",
  "2iExjK5tZAk2R7MwHF9Luk4raRSXc3JEnTJY97VtWcQ4":
    "gmzxiGrfWNBADq3jnwWC6p1ufS6ZMJhQvY64aCVBzfS",
  DTbHjVBswYM7cUHweMBLP1QSiawhkj3qAMqevCu5GJEH:
    "9a5XMT3fhjZapFY3BkfVqVhJijFAfdvLPrwVpdbnF8vJ",
  "6qVt5ukQMcdUqdvoBcD9yPnyXcbenj4zv8EZLiUgqnJD":
    "BzXRmuUyxLDqt9wcMSTY5wKJF3A5V7h92nYXvEcQKpXb",
  "3KMHu8QgbMWcgxi6k3X8NGdZ7NhKMUQ4zi8sFnBuM19m":
    "3eTFr3nKTnnLd6rYhpwmCZHqo3AWwXWqcTSNuBHJSHfo",
  CL6VvSqae38LooQ21ZKnJeZoisGTSKZ4MmqyFhbqHsLm:
    "HgjxJ9aBgifrPDS5pZGZjhk4agMpky9h21815rb9w3KT",
  AF6ecWdDRRLG4uiqVCYKkNr98WbFs7o5Pk3HwJpNYHdH:
    "2b6vCxczya5PVNfAUvjXrjmrsLcsKsvp7DUuYvv6c1sz",
  Fiaui4vZUstroJ83qzTnVMuHuqof8u8byqaFwHkRDcQP:
    "E6q91rqrEUEAY9q985mL8b137fvAKGKaya7jskS6iKiX",
  HXy2bPMEBnA1vyw1Ha5AviTwxWe84e6D73z6Xk82PZaP:
    "7f5jcP5kGtgSG7vdZb8V4hWdDfyxf9qkndUSBo5wdej6",
  "2GKKQaD5XEbaQm1EQvuxDU1RCX1MtdzdqpZGtfwhcEqP":
    "Gc2FBxPnef1jXNusNfJ43AhyJXc14NSXp6VybPmZ71zh",
  CiiPBuamTUD7hWjgVBzA5jKNJs3UrhJXwGWdtzKvyjVA:
    "AUsxTw7oF77PoLPmt3TJRHznkMpFdSPs8DEL1b2kzGhu",
  FoEgph3HTqgb8D4f1wDydH4jjiRn7hY7SkJc1Dsiv5T7:
    "HAHEfZx7VD4AmzZhTcXjzzkEHtcqG3pXEL8crgmjTtYD",
  C935qmynbtLqAggi6oWbir51822t4rbYJguKsPDP6HmT:
    "Cjix7FyJwUWvRj6uexKEKyb7TkfkiSwHBC3iMuNmVEkM",
  "3jdLQC1QRLZMqG3FkTNgmB9eseDEgmYru21YJjd64nSp":
    "9KN7AgmJLZqm4uQhSNDnKqToQfpNFwNQKE8JATJuXLEU",
  Ehi3HNAGE7hC6SMSkDxYR4jtoNPCR8bbk3Q7xcxMqFhG:
    "JDGAx6y1rfpi9GQE8itj2VSZwRKAJjLp9zZVTwtBmq1B",
  HLQCcbXZHttMPVpRqVwKbcuDEHQwMFqVcHofe78gA3Za:
    "FHrnYCQAvVVo1MheYduyshwRXdggmUJa9ZtfLsFZG9aY",
  "8jMVtKJ5tGrAwhL5AfTR4hMi3iifGLF3KQ8jvURzB4zo":
    "3DwtUA71t7EGskRoZdGZwAbt8bSHJq2aZTCezQKDmiRr",
  E47gf1rYJzk1mUCmevSE7Aw382n28ZTCzNmy5axXsYUB:
    "6q841ySWeUUBfzqWFSUe3apH46x92FUroFvuG8jdwBZx",
  FpFyC4xvj7Yz5xLwKHWMU4zT2jfHUSQzT7NGPob1xGmw:
    "B6pfcoUoKqSKfPtQg8mnJZTYJ43DBLB7adEvLrRQLPr",
  GR7CrFSnZuzmR5j26dTdPZszxxnTRQSvVF6ByccdTojx:
    "GsEtuoLuKLZUy2t5AUJSaUx655aA59SSBU1GizmTAH5c",
  Dew1wdyZh9zZe9428sGJ1UoSe29PRARzV8oKKeDYFAQD:
    "29P418QSWoSM4oFm9yv9rRmj5XPUWn8kTBR3wKuLGqbx",
  "9Xj1AtCFDWXK51RdciCdYKytU4SDWUveUfD8M6AyyvBL":
    "AJBjQyNqp5CVJAZfgAP3DjzNUk2vM1CHGWieVqtnxUnB",
  "3aUWwbmLHyCcsdXv3kd5aENUunudCQQJQDzoRF3BaSvy":
    "8qRfgv9zsV9G2sbWPidJjj6soJzAZug8szBKnQfneYjK",
  Hzm7vBdK1B78Yc3QS3HhbYiEZ1FsrSFuTgXw3tjgcUV2:
    "HkyUoiYpGhybukeAcPU3tqFeQcGduaPevVbAuFs5P3ze",
  BWxnPzZ4Kea6sks728yMSZ2NGbBzg34p7bLaFUnxQSLm:
    "BxuHtLXLJnQTzPbwvxsGzpERTR7KfU2YG7VLSj9Hcmfu",
  "4eNhGvPgRBTM2MEkUcVjEQ1K46wRXX7xiLyosiY4n3EN":
    "7zRRsaid6DEFsSSzKN17BmXJXeHrb3GELdoia1Qgeqjw",
  "261Zk4Kq4z193ryXxQ79BjccBwQsrPWoMrmkPGrEfd12":
    "F8pJ9f11Zyzydzai3iknmPJmgXVGb9XGmc2oSD9HY4rW",
  KsfUtKzRGGAmXpiA7R4owgbAGZfjpqVVrJaQA2rbXgP:
    "BJHNg5jxZqnN1Yc4R67kWo7TRt5GYtUDtKyFdYNVj1Ns",
  "5kb2rpnL9391bqsqHGUu1svRZZZ4fzyMGfm1dHQxj2Ri":
    "4G6piZsCLk9fyoAeaJbE9i4xKgsA7sRmMRvr56CoCKfy",
  AmAVAJkaHsCsjCdfXsf2QpGxjWUEmjuK1XKgR5hLJoDL:
    "DLHo8dVo1SaonhBEcY8XLK8CbGb5ohJzBWH7SNtvuqww",
  CKpB561ujNVtQtwCbRmDhvAF4WW58obj2xyog5LETYK5:
    "2gVnALHwcBuGjUSQacrosLwxDn7zHJmAVCyHtEp1Hnzh",
  HRJjNktmBYCJ5ViatWmV9wDtTSuL4P2QApw5QiUYZ32V:
    "4vPjgug9TZREepqHvBgFsaT8FdFjUCXB5VHMe222xtaP",
  "5KoeBfNNiEyuNx2AUxsUYYNDErjQgGSStX7cG9f4LikA":
    "GoayJgs5biuCNDSzrD75j17ZEMXpg8vxeBQCiVrtbnsC",
  "9dmSHYDeVDvB8t6wVAcTF3Khw9n9V9eMzTdDA43p8Lu3":
    "ANniNkAavjFk6dsmn4bBV1Yg6wHXeouGUzooayipGN49",
  "6nVd8RHiNNHSmJt5icV1yCw9GQ693hCZGrBKDXDRpe81":
    "3AUi6vpvTnNFk4KJFFx7LEGNBmky7UT6iGJhLZxh2bqz",
  "9Zt8mUjJQBB7mouy7S4UyeKfbPpa2soPWf9Jmty9qveJ":
    "CDwHmPvAs2gTjM81xvUduLwrsqGfbdGmVxNTfY1uFrDN",
  "2kKmPZY1q3xnmUrfGGwyYWqmHpKAbvG4oCQ44mhD71jr":
    "BcWbkVxsgnL3wCerCkYwZxR8EKQXpbbVMoxCuNdyNYiY",
  "4uNCYG1AMTPLY7NHti2bUw6DWiFGM8hwdZjvJWDGz6xc":
    "4n7LNM49DdHFXXN25kwnscoAPj68BfSsVgTdYXjz13xj",
  AdnCy3nW3UPScdFtinYwyXaMn1HMyPcr3bckrKx8TgMJ:
    "7Wcvgn9nBsgv2CqyR5B9NYRSBeHeeRrvtyPgrNMYA39b",
  "3SLwsc6YnLcnHLbpchdzZbY1wNRmi2CsqyzudppH2Lhq":
    "9sHnnawYpbqQUksL62Bbk2riAK3tsY3hRrZ6NKp5VqB6",
  "38v3wJEbFCXcTRDc6cZhs8cWpEdnHpEdB2jvtbBo7UtU":
    "BhsYcD33Bpk8CTKqmQLQJs2mMPF3XDkkqbBfNALBUBtS",
  C9YciWAqhK75DZfH986JjF8fECgeaJs5W7uZjYFNdP6K:
    "Bc6mAaZdZwFuj69thQdu7Vwi8bLqTVUtBH4H2MJaLw4j",
  A96NAf1X1aX8LDM9CbhXuFu52LPivxhb9QrMTR9bZTVi:
    "AtfqqTof5RGMnrSBM14WYK13T5sdQMkKwSbJ3yhhLKw6",
  "7W644kUb6J8ZCZXwYPsSahwqAJWEWoXp2jhXBAxMrAAT":
    "Ev1LTfEyFbhNyGBB7cSKohxAedsAv3JiVn4FyADfPJSv",
  "6pQgSWWSnpx3tBujiWh5vzD1R3wgAtSoaXyzzQSKNYGY":
    "BxKRY4o8YiCC82XRVQqujHAmBoQk1Uw1DBcfPABD7JVS",
  "4oqAaDYWfXDtTzCbCWP89LYWG1McZHMBaKDQiXqxaYoN":
    "FkjFGrDrnVPu9x9pdoMHLi3xiXwgC9CW5rWKqUYg3EBz",
  "32Spj6mPRvNJmru6BRvtyMsCsbWgXGKXnapKfgyEhY5x":
    "rP2yG2jrNoK5MFZmTZZtbxaKkFGmoJEooPzaXpFsUCt",
  G3gsw9D4jcrpjbP7e7pq8KuKSBxxetMWzPRJxBRVWHi7:
    "A8P4KDRyDcGEUHWLiD6E2P7NaoiibuGcEPLi3EEYj7CG",
  EzCYBkda1owcYqQTfhdHmdQRsiEKrnuRvFEHCKskyJdh:
    "CtJFSFWJUj5wAwtHnTpE7fUUiLHzghywYCY2vm9fy4BL",
  "6XZmVGq3oxaDa293xmmvoazF9ny8D5zzVjvWvsC9rYSY":
    "3hhHqyYJSj8M22uFfdbxA8AEjZ5ygSh9dxf2tbBv32sM",
  "9NrJDHYh3LbXjzQ51RRS5TooTk9qXGAjPvuN7F9DxVMA":
    "EsKi67ftRrdirwmkjF5nDC2uWDY3vPHNzFuA86u2iUBB",
  AwTB6tckk6xQ6Bjch8LEk8z9hQDjM8EVpbzdHUwQnK2n:
    "7oLeV3xo4JX3ZT3eJDtRQiHUC9jCBzmsXd7tHnPe5wrN",
  "7V8BwMNujRQdodo9wcb1dmnuqebZrKc2uisnEXp2DpW3":
    "Atr8vWUxm3mimfm9daUdHYKDMHx6Ce7LHjncLdQQ3CZX",
  "7AsyxDmrPMnAjoaddmGRpARmutpeU2jZa1u5JaQJsGPf":
    "281kNbEELfJguFJvELjXBFTrk6tBuBwG5eVApZVYyZqX",
  GaE3AAeyKe1y2r1Y2Q4kddt15wqqfyeLrYDQmtPyjSdW:
    "9v8SfKxPPGqxQX54KKFbgRdXxQx9WkzC9y72FnmmtoNr",
  "4LVRkQcS6ysB7FW4wUaXcrpp5pvchbtkjFMRYQhbrx8i":
    "B9t6WSCRgY5FteY5U8abndeq9dt6B6Vy3MfxfBg4grJi",
  "7M14p4SgRJci87swvxmXKThm3WdiaPADMjjLRkyfBHGG":
    "BmoXSens9v4CcActBGzUnBzq7eQ7876SWvBL4LMCXDaR",
  "33ro3qgY5WNcDEbLCw47UfZQvjUC7CXFRkAuPtWDXUUJ":
    "E5SGVAYBjY4BF3NXUimfJC4P7Ngj4QDZzhMsJppf6Q29",
  DjiC5MiyRFJY58QXGABCmDT1S8EhLFaNez6QfRZSzqjz:
    "EnDnWowJGKRTdNn1j7ao4DtEGc8B4p3yvJML3Tms9K1X",
  "84eYdKnci4VfnNtn2ohaoc3SyQKE2jG2zQ8ic1q2H52Y":
    "GqkhLZz3FdbPVTxW85VT81WeFqheHg3gFHM9EfFeYweo",
  BRLN48wVgoKMg5cEVVWwqhgHkABysiDXu92vWA9yEaiw:
    "6QTr4DaHNuCDZS3LhbN9N9oGSLueT6xhdV3LHN6LCTxt",
  "2ATWcbtpxfdaK7bXw5NP7DuMMQpqSmoHaPr1MecRgzDo":
    "4im295cKMNuNV4dNkW8SRTvuQjwech6eZwxBcEtYhK4e",
  "8mydXx379Z98UuYUZGKUtDR93arpKkkWjGzZjNfPETnZ":
    "2p28TTL9Cjy2aoCL2QnLGdcwiKyZUaW6biHaKYktuKDu",
  "4bkz2Ne8Z249hDhp5a6ikrx4JEm58xabMn2ZypmNVXAv":
    "AYd7WpVBVSHhEJpKL9JpQSjwstwBGyDY6SJKr19Vxfij",
  "7QQN9oynnihEFqxskQWUqNEL1XW7gLnxMN5cPJwdDxj8":
    "FBxE3R9mvQievpcQjTGVXxs4cn5AnnQngBsT58e93oMo",
  "939ZjeigpS1X7ew8swNymQKkpQ97oHrCcskM69Eiqk47":
    "1SdEJnnXAuVyTwbBHDyb3NauR8MheQ6dGMhHS2cpdqp",
  "6zXgmtuSMVrE9StP5CsrMLpPgCq57g8meorXPBvFyNyi":
    "FWQD3HxHKPffKTT3TuL4Ek7D8qaYuwj48SF6h6Dx8Tbq",
  "8zjc7hN3uzm2YSrnvm66PtFTC5xCaxwQ4NN14fSfzB65":
    "Am9aMhb8tJgF7a56LXnhrZkSJi7bQHhgXLStCFhiEHHW",
  DGdHEFSQemuJDyTLgzgqthNEpha4siM1L1VeR6UmbdbE:
    "HJAu73Rkf2H6W5mEkuoniRBK1Lpqwot9WY22fKCtUSVK",
  "2kMWzTH94hsuusBfd5NnTEaYTDTKaMBhTdztwaePxr6M":
    "6r5A7gveADbS6vBY2Tt8xANAjGPFkGKyEdcQqCmpBt3m",
  "7UFYsd2acVioynAyqT2Es2gHtCZE14qx9mumWEhKoWdY":
    "9cH451Hs3ukMcCvoECiojujNJ4mBh5hpGs3hsMngChpL",
  "38svmzo2nKN8URmbf8evJWCLoqGtEbHdiEjdj7Ahpg9T":
    "FwEt45w7SViHvsaVB2kFF1nRJnnDkZoKimc8UiP61Qen",
  "3gaBdLehaNJbu78S3CvtxUxmdp7S6283q114AqnQD38N":
    "9RGwzuS6KAnDsapc5ceXzr1CeuG3bjSNWucZnhtxWeS",
  zZfDxZf8e1FZjktwYhh2YXQmPEVN8ocZEB64r1CaH74:
    "FVhtRMtbMzNs3GheMz1mZW3QGWn8LwabvGWGnpcuP4gW",
  Frhm5jceHEQJXVYT4m1wT5CWPFesFSgv7ksw1Fu93edf:
    "Eyp5duSHfWFTvhfCUBbucZRZ31g2suQbnHyMeSx3QxHJ",
  "3PmeSqFu2C7VGpAAycBqV5qqeVHzZg8wBVPSyvcW65NF":
    "9nytx5fs3WFAUccBk1byooocKSXnRXwiXPvFCY4mA2Gd",
  "7ZZv1NSN687pTVadwAxtdNtygrtc7LL7ggybcKJbBj55":
    "AQqPSnVJ2k1mCayXigWXQYt5VfCJYvj1sW5iDBAtbJMH",
  "4YFvfGwgBt38QAsmNAGzingfvnZbbhEZaGXERubFY8N6":
    "BdsbC1SwKMHq3kSWK1tWHKDnCxFzCQKfuAwLGMQRFu2F",
  "6DvJwyts2KNVUN6G5FezavAAEnfipvkAWFbrMP9J4g8Z":
    "Bou76fs7VYPFffLb1f2XHdXkLx66DsY4yVjjJGwHCBey",
  "658wiagg8XuQyJ4xQhm4FEFxZVZgbpYVnpLeLDYRmB86":
    "HU1xYrmVtrfm7TpzfdqnnCbUstGJmjig1w7jsrT767Xc",
  G9X4dYVY5gip2Eh9AZHVUBQafNDVfMw82GKzgJspboJM:
    "CT7zAkb35NQHmmigSCrSfJj6if4drUV5ADvC5jy2grZj",
  BiBYyKPyhbwKqDccKBU1kzKrmpm3BcVNzqqYrhH7Djmt:
    "8pTc1tveboCFLjDbqtvZzC3sq2n5aRdfU1hA4h6Vp5ak",
  BahuuoPHDZXfycNCHZDBRF439CA6t8VaCJSaUNetSKDR:
    "C8nG1t3ipjuShiGaCovAidq2ZMGtSpakgr2uzwM6rXzd",
  "2KLgVWqg639Nh2j7o67Hw8Lg9DcKBEJ2qGXmvYHXdFX5":
    "9FJaXhxnsm2sXqQGMEf5AbJz1pKto9mQUGbsex4khHja",
  Fuhh2uEyGgP1JiXsR11nsowGxvAt4Mxvi1vJh9BXvLHH:
    "CCdJBzxvCL9ArwafhkAQMtBcV77DDzNDSoSc3xNEJkGw",
  "93VEAjMJnS9oqhqBaU8fZLNUPLmFU6TkNa6BHSS2sNtW":
    "9vorP88f4vej55RhZbZSRbhXaEs3nFGwEBDDwEkViwnn",
  "2BVcrCixYkUMUQrfJCckfF8iadkMarZS8pQp6bSHADc3":
    "HNTJV5gq3eURmQ2Wf5Aftg5Rr5moXQcgv9JRTgxfsmEz",
  FoKUTwcWpLYqprMUpsx3nwqRZsSdjJLbvLv7JYTSiDLh:
    "GbXZc6sEChWbVbn4SrxVnBndYg73wC95V6ai1MX365Yc",
  H5gzMNfEqAeL1AerouW48PJMJhjDRTWkK7DtjbqDRGBN:
    "DUQnCdWD3S7nzKogRegRyYgQ9gGPWDf4iKG9Jjcs45LD",
  "8wworpkMdKtBzn7TuMSHz8zcb8E1vnjbusDF6dL5Yde8":
    "CaVpWY5frg86v9X8utjozhb7Bz15ihv6fTBm1rBMgjSu",
  "4vf5GwpncntoPpbRCzjPDpo88JTuPjwsjuwymyXpr9Lq":
    "3CPDrbMSgPHrQq7iFFsuX1xKTfT2rUxfX17tu3VkUq1c",
  "5APbfyzvNZCyhGkRN2hP6QPVgHW14T1yqXq3FxHL3i9r":
    "EitMfoDiza5VihKzHeyQL8rsfRbAenL9csnk6XCYByGP",
  "3Nm6RswTUtd187MJPFWHUqy9nzuhfRRxqwkzkfSSuVFx":
    "CzHWJwFDFWeHVSQ3H54cpyq3zPWn9UeErEvXQsUZdnPY",
  GqPgjwqByoRQcusQnckP53aTzq32zbTW47BgjWH15n39:
    "FxMwDkr5wEvRUJPwxWbdqXtabXaEUpZr7V1wTPF7KvMe",
  "2rQRidAVq2opXLzT9UF2HUgrwKDWVzZ4JBEnFQRX556E":
    "G9BSoAbxaNz2CRpoeDL4CnD5BmY9xWaMN5s9R7DoCcK2",
  CXSPunj6TzmQ3tCrT5MXBTyqLXkH6DA6tqyvVRUQvQNx:
    "E5vvhAtYT7PhbNB5fXA61sUUJHNhcrBdFGk6smycu2h7",
  "3MPxcpbFy2vFxVEtaqzB4KEiMjKmRHs9mwqFmCr5ywDq":
    "E2pwAhePGV67rhXhfaYqsduvJvwMUFaRTkJ3JBoMsrDb",
  "2cKGgfdHqwJB5ADcdwZPxEJvmHCaTAr22YMoyb8qiT6A":
    "7Jvi3bEyKNaBcVBv2jkBf7uabXXapaSe23ov1v8cChib",
  "64GKguDxGhxyuQAFsEYBWmCuZLvPYXkK7ktFg7KQovoX":
    "Gcg5YuBEu3fKWPdmAALFNxhHbm3BE5pLuUQ6Tt3zwyc8",
  CkUUWsJLCjdhSaXcBVfMaYJksCmz6vYWLAW4hj9VtLQo:
    "9hiq2KiRLwgVCqwCC8Qv4RXp5UtQhEphF2L6XB2sXfnU",
  BScWgTBMZ8v2W3heH7RGmHVoyoHcayDR71CYi2Te7j8m:
    "G6hUUJf6i1KJ1JAhFnDUPSDd6jBCwmvrhCi5nSAT9Usr",
  "95H1Frq6GpLEPhjxd8gPkWZjrxEgQHFtEDy3hgMRbpzV":
    "7hHHBPNPuMuUXH7g61hu4Kzrujo4dyTmvZtDHbTP8wds",
  HcL9frJ38QpZHHLjKQKjfYgTcEJmXGSkdd7RyvQFXWNt:
    "GBb66yRTjskEMr5YnLMx4ttufnuRjWHuwmh2sD8h53VS",
  "3qLHu87suq8Uu3jkZ6WivC711xb6NmRGQJaW23QUYpGt":
    "47DpSvgSC8YUR9bYmRpwySu5eNAuK95xdTb4sg5v6VNa",
  AuGbNh7QCtRM9c6WtE8eNQgYxJ3ywcF9yNQ9E7xQiFYz:
    "3qaVvS74aFaeC4xVK4owhH1jq7wopwwJbqPd5ETEdbV9",
  B7Xw6mvWFtPzF9jz5C9DFw7aUZcVZyANRJ17cvfkncPZ:
    "DSzSNLriBJmn5GtEiGbbnazHDcdgQrSjikEtaJb5VVW3",
  ATiD8ZLh6ciJHELfVPajPCGnURv2SxPV3kvjvN9sztTC:
    "GXBSXyM9pJb895Nm9CergyoY35bhRCpWRqC3yGc2f5Y5",
  BSpyf8unu9kaCKGGhNQWBe5KLsPfkJPg2eYHoWfWcEy6:
    "BKQeW7e85t8Mp26BY8fbUKY2fmHdfVwJis5wZsUshv5M",
  GTUaSFEm4JyTMsZHPfwTsCGEG1vjk5bjEn3cXtkoRqHm:
    "LEH9QJxsR2Vei5iyDkcbBv7eGEgrNTX8HwgYuaTkP6g",
  F62JYztwYSMCowxzhT8pg5pnf5XM5K1C1hfmKGoiiEJf:
    "EzcsE5ZkpKEWrd7DvKwA5T6T2phwQT52SaW5EGMiEoPF",
  Aa9WUzJzRQhtbHbJeFi2Y3NPJPpKwQetNz6hr23akKdA:
    "BtpUdBcXLZUh1dKMT6y62M6ZQxg4zUeM7xb9meyq9hsb",
  vhVPM9d3t5koXGKMCTN7aHMwKjsaTcSKKQkUidtYVBc:
    "4sK2Nhhevg1wt8SVkuK5dMKCgFh5vWSpamz3u5xodAfX",
  "6MepqUVb99Ba144JJtdexAU331SKRpqKmta1oigtVJyb":
    "4a5hmB86QUZwWgPsJ3tuGWEDdxWdJdaLrhw9DBKdfxwW",
  "9RdoSRWksSZC1yjjCmtpBSUDpcTaWXkgGir7fe5NFHjF":
    "2NuxbYbBpWqz59g82684adAWX6WT7rtmHXx8T55SVHUY",
  "8Aq6iYBBPENjAppKapYoLyfbs1CosYu5n1bw3jkSYBs9":
    "HDVUrG4JjWRMsPrx7CAAMR7b4gMpNAXd3RScvvv3PY3Q",
  DXMLGRv7ZsxAjR1wPAhQQA2F9R9r59BNqPjotKxJQVxp:
    "57jqzceDNvvnQLgUuRh3JEL5TjJFn3AVbprrioonQ4tZ",
  CTLaMv6oLgfn7aANefftLh7yKZGjH1FyKtbTzsrD97UM:
    "37mFW2F1dtujsk2ZfkbGCNCbRK2JmjwgvWtTnv4F3abf",
  "2BDpuUVbkHghMpZVSWwALqhG6Kisia7H1m4MFvLCEGTQ":
    "EjSTeL4x5eNcf9f9RQRdhqSYGc4FXqgxmNzFwE2SMrad",
  "8bJ7B5paUrKXXQvYD9B5KKCNozPU4mpvEVzfyYJxvJCg":
    "CcfRMppeMNdyqyykv7xRZGkhjbmhERVhTBhiRyqsHhAt",
  "5GyUaPEDYGUxEtaDgBozgMRsptUSjwtQoRTsQTZjD5g7":
    "8trufk3s24nFtr5Y73H3y12CgTz3HpZEkHS7DB5TNSUk",
  CHXjNFEZBF4jNAhm1D73zbHDzxSmSX9v73vPA5KiyBwR:
    "36Dy1NqtkQUxDt91jK7HfnrVPejeTXCgvMgQ2wZo1iHM",
  DpjkveHj8GuHLmNktwctRd7G4ioh2YU9R4e2nBAVEjBV:
    "9Ki8w3rFcgPBap6wYQmLRJGBgNDqFinAL8Gnn1C6P5QV",
  BkFUbqxsZEW6gJL8H2VTEYbh81LAYkNtcMRRvXnmR6U2:
    "5peC3gn2Gmu1rKZrbcx2oUCcKo4d1C1rB4REcTn9XbuX",
  "41EB6crVLenMGGzjjVVPX4jeU2AiEx6fwK5qz2Dee77k":
    "He4xhxYSByneDBt8fXvWxWZiLVzwMmjzYyscRgQh2pJx",
  EZDxHJ6EYs7KBa5ufZXyTKVFC64eAbwEtMzEz38UGzpo:
    "4yoVbrWnRQXtWX4whiS19RSfrFLgdGgGrR22qhyQUfHA",
  E6doMsLCxWcoTiTcqFVmxihHhcUhigWvpwzL9f8H8z3V:
    "2wRMFMLCLuD1oGGQ1gpD22fq8Cfi6K1HtK6ycsfSs6i1",
  z9R4qxKHBQ6EKtznfCG1HhecKFCEmzoGfvjQWcJD3gC:
    "12Hith6T9L13bcMbosAtyNXZjvC9GgkpzwjtwpxqyJpH",
  "81s1pZngKjBxBQGYSowr2JTLzwambr978A4dE9qqXk2h":
    "2vVRphQvpGsyydsm7zRhLwKsvLXCXbDYAMZnpsXxwYQT",
  "6vyGLyGCS3NFxb8fHMKzADpd2VBXePHeQdRCusSkpimN":
    "FLomU1Jyh7LxWZ9TUA9JVcfTJGNgVRbaN1ePxviN7nBW",
  "61NqSnbxidWktLssTJTuj4p2En8rau2r9uLX7ERQdMD1":
    "2KabGSY3htxfiLbQzzswxwFEqooipCiqg4raedRxsDc9",
  "4ukCCp3h2i5vU327NMFHiZkrpKJbxyYfKf1XtXP3Rzm7":
    "FEzNfxtEeq4iUoEAd9ff1dU5g2MhqejZLtkBsik9TxdY",
  "5dkG8UpmdvjxwBH9GLEGxcX1tm86wyx6udX5TbgKWna9":
    "2TuRwL51F6VuabeV3KM672Jp6mUaFD3YYoubqYifJjW8",
  "8GFjQhdJWfdsSTCVesGzn5FCmXPrps2cLRdqMKZW5dU7":
    "J1w8eM69G3wTfgkDxJczKy83U43FvzqYnPAuvgP2wKNR",
  "4z2oPZFfFJoaK17BQEM5KWh6VCzF9qX3v2NvhDwnrMhu":
    "EHcfn56g3gZD22ZR7HgxoDPov7x7andwUxbHEVh545pu",
  FESoyxN6R7G8Kvt1gBcqsogMkeP7HbA72bqYrN3zxZpK:
    "BwWSZZXV4smjBiZstCgpuCzdvUBCfb5V27mfMR9YoZ2a",
  "6mZpYDQRXStKfLY87oskdhzgzbA4niYnQ83gAQJet6fA":
    "DTV3BLQixLkdKAyhy9KHmzUytTxCYmodHwwox5UQJYDT",
  "8f6t9FaWvgsiS6qoiZPCV7hEnRGxCrVdCzxKjHKiwCPW":
    "CjWbiBx9sQS5V46pUFp8uDvyKHWU5PCgpKEBamQT7rAA",
  "6CVyFANMqzQywAAmcSyz5Tar3cbxRsyGrNAjYCRDGBV4":
    "8LwhFmqXeoxv4bAcipfV6kEq9xNWNXUPSeAxaHqaP6kU",
  FYAW8hW9gGY1VEqndtH5RAyHZswv4SbXRdBjHif2m75R:
    "3D2CD8U9dtTJrRk24mGwHfhmHjjKiTm6nHANgnuddYdN",
  "5Mu1cRAJegKJ9neqEph7ZoLqXWhrWcAPZNZUKs5LeFXq":
    "3SeFTAKeQPXaCnYyMh7fasQ7QDZU3ijKgmYQmb7HzB5D",
  "2jLxyxae44Fa9AeW8AkLhJDb5k9UC8vDR4qr6FfW9Qmn":
    "FgQ7rDabb65FV7a8jdmfitaA6ZkjJSk6ZoBL2bnDvgKf",
  "9h5JoYA5PsJohop2P93bL3uiszw8WnE6FoMCN7JUC91N":
    "5x7esBbmkqZLc3b5p7PR5knvPUJ3cviVp9rXv6tyY9vE",
  A6TdkjsdCYgfTQVh3NGjHXQMvZDhKinscmJuaQ8ndckK:
    "28eJnihqT6xafhkRbCyrdBoytUxbDnCbQuEmwxGeP4xy",
  J58BC4cJTMGLQHHs5hpx2cdToV8SFmaUxGTDtn9vATcD:
    "67tJ7ABrtfQKU4h2kmxcoZ92xxvebCg5oJiXQLrSxo7P",
  CnRpdhJctL9X3PPFGJEopUNDjL4DSj8BdfHY25DF4Nre:
    "5qCNsgVdTGKT8hJvAqPzUn4SsQR34ATZKoFMXVdWmBWs",
  "4yDhLkdvxZAg9wQcNVa3UVdZhFLdcPzD5Fs6e1QpURs8":
    "EpiBym2tSjSWTqg7fKePUr4x8zS5GzcKnhKFXLd5hQSk",
  B3vyEPMvFGVs3tPLfiBgDANnWhrLHxdgeUtQr7YvUFZ:
    "GLaxJXGN59PfgsosT3YVnznQvhuXKHqKagdpCHEoyuMs",
  CzfL68fRUiD6SRdaPZwCzLuyQjQMf2XHnUBkGTawiSz2:
    "AAHJbNs6xZbUKDPwpJhbjYwQ7BEK6kySckBLNmGHmibW",
  AX14T4MD4fLixFrj2SxH3NcAYbZ6FiwbWNk3YtDdf5K8:
    "GvsNL8Yg8PsXbNBVuAvxeJ75TDwH8LDPHhDbNES2w1xE",
  DgdQHF7Rk6YJm5SAAvziefzUgRDys9jv2fLArL2kHe9w:
    "7uJCWESFKMRioEoZ7voKizWoDiZm47hUbLgEE2Dq3yy",
  Bbx2R92TH4JaKdmGiY9UPyw74W8hpF7DN1trMeyzusBA:
    "2z562ozHjV9DW9GNbvWD8qTSyTa7DJZD21w2nVDPYFYm",
  "5jbE8dHBWnXK6Ztwi2yGgTQQpR579VMGnxeviSBVk7N4":
    "gMsqRbNJt612b35YgCwzZD8x7TrHAPLaivSLaiefsDG",
  CyHc4To9XmjHBomd94Wg79AzfJR6raqbzXxPayuBZRUi:
    "A9xdz4tG4jPMSLrj2z8NAAv5jdJyZPAG4inwrM6qM8k9",
  CpQV9NbfzuSUyTaZBEQemMVPo7uk5JVmVTq5PUH5PUAj:
    "84hmPgpJpoEsbjjetFX4DZVskwd2vLxjUMtKMQMVMC4P",
  "3Tncp9CM3bVdFXVvaSmFGydewmkqCX7PeTJoL57zZwLD":
    "F3jQ9mXCPKxzzVKdwycSu2g3Fhn9FTmNzx18DBoLskqj",
  "7DxA6F1b2sHLJJ5U2y2cerJ4vhK197jLtYTVDxmHH5xM":
    "224WpVdnnAJjDAD7eaUebCSh9Zu6K2jKkwdwA2Rzs58w",
  EECJhZnWxFfdd1BJuUTEuFkv3EVzEFKVgMfCrErFDUQ8:
    "9US1czwE5YiWdsx6XgGMZCUuh4p8BbsDDNKcVCZBeNVT",
  "9BsLm2Yfmi6HFNSUBMTPuLn4yb6N5gg718mB34uxjUmt":
    "G5hbh7GSEsbzWVoahuc2bqFzQhsoBZYDzdE7rNqmHyKC",
  aQd98oowcZ5dD4AWW5uMpXiUKDC7WTLD5qfkE8TqnB9:
    "GtQsmGqSRsq2cJf7tfzFz1DfJEL4TASPGGSscwL6MBS7",
  EgEUxq7VcxcmZrRCm1Ucm4eGYB5Tp29heNjqUrkPSmk5:
    "9NveMf5BjnSBgHPc9XNqbNZFho2UtQrva8Gy7M3xhNmi",
  "8avJAAiNZvfX8E3CBbvQiuw6Lb6JjaNgF33ARMY27VBT":
    "AxxnikF3stERYpFGK2LmA2mkZib9zLZkyb54vjk3vsF7",
  "6ofazCaBsgKNsGzUiDybTqshqkHBN7XbXCDgYqedoDu4":
    "BHsqqTPBs4SELtx1sMp1sj5UHTuiNwBeDa5PAfkVz2F3",
  "5RxuRcmdWGfBJAsinezXnXKFiai5Nfdq7aag8QMNWuDt":
    "7raLJ9p2YWxrKss8nsrboYWfny1cfTH9DzvgWZeEMj3d",
  "3LFqBmScydPTSwEeUqchwzPUCHNXX3vrzGe9PvAJ6UGt":
    "HYn59vkpzLBUPpjf3EvPdnqtdNCtFPqE1Jk6XNX6jQN2",
  "32YEP2vasyJH54Z2aMJTuaWULcWG5XF25VAMQn2B57FM":
    "ARvQfrYMd17A4PUkEgHoU2ssLbxqLRro4UnCFJKSDinV",
  C1b73erghe7HabRAZK4wSVV9Ub4GfY3qr5P6aa4kiE3n:
    "FZkzp4AdmP79i9NndVMBkHE98a3qScLNtwk58cR9Um8q",
  "4o8WpgKQBvSQQAjQiGJ1v2RH9WgtzdVCdLy75C41HAKP":
    "7i1GxoS6jfMkE62zuVSJFNdphoCfzhdHM7J1B7oKbjJP",
  As8SMpCBq4RyY3mCJXU9SwytLYk6ajDxNpWoHk8incpp:
    "DzdpSU7yTazBFK2CS437icJ7kbBoK7GY13xQBLLwFMee",
  "5rqL2cJpTde9YGT1EPTLwcehgVw5pP8Ce4ZretcUSW6q":
    "7pTx6GxS4Lf55ztPoZ6nG41LEuPij6EEeTMAiHeQ4Vci",
  "7SWL9UiMW6AoSnvHpmSiiQKvbKs24W8s7aUNwj7SnkrH":
    "3WVKAeJxpgcaKeQAbc2tUxTGwB6qpPtkBHgMyuCKS7YP",
  "9JSTqzUguMcW2GXXQYGp2HxRFGaQUdG3bDbxk1yahMeW":
    "7E4SdTrCFE4YnHhn7UmXQkTV61XX8kHeEtjq17hvZJMH",
  "9LLW4VXW3i5mhg2noRc3C21fJZjmwftBiruSvKYfhAN":
    "Ay3Gjz3aN1BZQvCsChcxgK3v7bNvjZEBR6f61NrwmPCm",
  BnNE1M2CS71hTDUQDfZRJkborJA5qfMg79YmM9uoiNdV:
    "Bdqihy5RXTuMoJpnEs9j8N2q3JSwENGKyUhUfe3qoRNp",
  GPzbJ1unDFsBQ7563aEgpgKpAhwQSf73esU2HkGU7CVR:
    "BsBSuqbLB2V1bg4YiA7pMeVhCo2yuFjg7xmWX9bZpyxW",
  B118VCEHhCHqLGMPtbdShvpjXSF2WKXhC3sdFC29nWpd:
    "DguRMPMLKJWVBAyNroUc7X3cvWt9qWTZ2k8hADFcwZsr",
  "7TbJNcgyNi4E1QfTbGNPBmp33E8Lhzq1Cw2D3S2fLm2s":
    "3kRRi1G1fFmHUaXDh6NcECuyEneqHFPJJtC9XsEWUSAD",
  "7qAdL97t8Txhs43az1vkwGrhSZVZ8qWepmwRHwsqMjZ9":
    "GXVzC1azQapq25Yee1mTFmRLJgoDZ7deJqYj95r4Hjuj",
  FfsgGu59rrdvvJB3ULHLfHUTCC5LF7HP3GrHGfz9RTDZ:
    "34MuMHiYBeBYZxjrY88Bdg7SGUgnbJeSC5mWMEoD3Zeo",
  "4vHCBMUjPyJN9zU7Vvewuu9xjYiEeKyAz7ZdbWcYihCP":
    "68MdP34oegSJc1wrufSw8iX9wurME8ZY8JT82AivJ58z",
  ENvWZgnvNbJt9gzzghEhn5iBdpTSuwpqCf6Sw2UcbYef:
    "6EA5Gq9CmQupNZdsfSf9FENn7pRQ8FYwv5TQjFgxUFEF",
  BhwWcewzcsmZL82EAqkymyLRevakrQZ8d28nXBADyYm4:
    "DsjxhvK1dwcasxPSsFuYqC8P7Mk8XCJnWj2gFKPJEMWa",
  "148gZPYmsdoq7euYhjHeJ3rqEx9VJe1frq1cEkaFU7Eu":
    "BbqRWA71994BSpwKbrWLEKuLcirGwopPQ2cm3oHa2G6Q",
};

export const getLinks = async (
  userEmails: string[],
  cluster = "devnet",
  baseUrl = "https://events.cardinal.so",
  ticketId = "crd-vF1rCIVARtDGV8udx9tZ-30573",
  eventShortLink = "solana-spaces-unveiling",
  config = "solana-spaces",
  payer = "spce4Vksnb7szvEZLEgCQpmgkiy4ZgmN9eNWifJVVtA",
  dryRun = false
) => {
  const allLinks: string[] = [];
  const connection = connectionFor(cluster);
  const event = await tryGetEventFromShortlink(eventShortLink);
  if (!event) throw "Invalid event";
  const ticket = await getTicket(ticketId);
  const failedUserEmails: string[] = [];

  const emailClient = new postmark.ServerClient(
    "b48c5441-9afe-4bff-952d-49cbe70e5102"
  );

  const responseQuery = eventFirestore
    .collection("responses")
    .where("ticketId", "==", ticketId);
  const responseSnap = (await responseQuery.get()).docs;
  const responseObjects: { data: FirebaseResponse; id: string }[] =
    responseSnap.map((response) => ({
      data: response.data() as FirebaseResponse,
      id: response.id,
    }));

  for (let i = 0; i < userEmails.length; i++) {
    console.log(`----------(${i + 1}/${userEmails.length})--------------`);
    const destination = userEmails[i];
    let claimLink = "";
    try {
      const userResponeObjects = responseObjects.filter(
        (response) =>
          response.data.approvalData?.type === "email" &&
          response.data.approvalData?.value === destination
      );

      if (userResponeObjects.length === 0) {
        throw "Found 0 responses for this email";
      }
      const userResponse = userResponeObjects[0];

      if (userResponse.data.claimerAddress !== null) {
        throw "User has claimed their ticket";
      }

      const claimApproverKey =
        userResponse.data.approvalSignerPubkey?.toString();

      if (!claimApproverKey) {
        throw "No Claim approver key found";
      }

      const approvalQuery = eventFirestore
        .collection("approvals")
        .where("responseId", "==", userResponse.id);
      const approvalSnap = (await approvalQuery.get()).docs;
      if (approvalSnap.length !== 1) {
        throw "No approval found!";
      }
      const approvalObject = approvalSnap[0].data() as FirebaseApproval;
      if (!approvalObject.secretKey) {
        throw "No approval secret key found!";
      }

      const masterEditionMint = claimApproverToMintData[
        claimApproverKey
      ] as string;
      if (!masterEditionMint) {
        throw "No master edition mint found!";
      }

      claimLink = `${baseUrl}/solana-spaces/solana-spaces-unveiling/claim?mint=${masterEditionMint}&otp=${approvalObject.secretKey}&ticketId=${ticketId}`;

      allLinks.push(claimLink);

      await emailClient.sendEmail({
        From: "events@cardinal.so",
        To: destination,
        Subject:
          "Reminder: Claim your VIP Invite for Solana Embassy Unveiling, 09/29 w. DJ Sam Feldt",
        HtmlBody: reminderSuccessfulEmail(
          event,
          ticket.ticketName,
          ticket.docId,
          claimLink,
          config,
          userResponse.data.approvalData?.firstName ?? "there"
        ),
        TextBody:
          "Claim your Solana Embassy Unveiling ticket! Check your inbox for an email from events@cardinal.so.",
        MessageStream: "solana-spaces",
      });

      console.log("Sent reminder email to: ", destination);

      // await sendEmail(
      //   destination,
      //   approvalSuccessfulEmail(
      //     event,
      //     ticket.ticketName,
      //     ticket.docId,
      //     claimLink,
      //     config,
      //     userResponse.data.approvalData?.firstName ?? "there"
      //   ),
      //   ticket.ticketDescription
      // );
    } catch (e) {
      console.log("Failed", e);
      failedUserEmails.push(destination);
    }
  }

  if (failedUserEmails.length > 0) {
    console.log(failedUserEmails);
  }

  return allLinks;
};

type UserData = {
  email: string;
  firstName?: string;
};

// const emails = [
//   "0xAdmiral@protonmail.com",
//   "anand@solanaspaces.com",
//   "nat@atomic.vc",
//   "chester@atomic.vc",
//   "jack@atomic.vc",
//   "delian@foundersfund.com",
//   "Keith@foundersfund.com",
//   "shervin@pishevar.com",
//   "daniel@craftventures.com",
//   "glenn@bricktimber.com",
//   "Craig@dacra.com",
//   "agracias@valorep.com",
//   "david@craftventures.com",
//   "hunter_golderg@windermereprep.com",
//   "Matt@wearemanifold.con",
//   "poppy.simpson@netgear.com",
//   "ShaneCuervo@Gmail.com",
//   "Shekhtmananastasiya@startwithmore.com",
//   "julieoctav@gmail.com",
//   "Lapschersimon@liquality.io",
//   "Molnarbitcoindailyinfo@gmail.com",
//   "daniel@lulo.finance",
//   "Quinn.b@maple.finance",
//   "Volvoshine@hotmail.com",
//   "Adamccastro@gmail.com",
//   "manny@honest.poker",
//   "Natalie@rellasocial.com",
//   "hi@jennnguyen.net",
//   "Garciaantonio@spindl.xyz",
//   "Geoff@antifund.vc",
//   "Toby.berster@gmail.com",
//   "EGavin@miamigov.com",
//   "KCarswell@miamigov.com",
//   "KMontoya@miamigov.com",
//   "burhansebin@gmail.com",
//   "KRuiz@miamigov.com",
//   "ana.maria@blockstars.gg",
//   "NDemko@miamigov.com",
//   "team@cardinal.so",
//   "me@italo.dev",
//   "dat228@cornell.edu",
//   "svets.nina@gmail.com",
//   "ziser@wmeagency.com",
//   "WinklerKyleJ@gmail.com",
//   "kyle@wetiko.work",
//   "blairstepinista@gmail.com",
//   "payoula.k@gmail.com",
//   "marc@blanksoles.com",
//   "toly@solana.com",
//   "raj@solana.com",
//   "rodri@crossmint.io",
//   "scimmet@authenticbrands.com",
//   "judy@raydium.io",
//   "tom@raydium.io",
//   "d.won@rarible.com",
//   "david.schwab@octagon.com",
//   "chris@jetprotocol.io",
//   "wil@jetprotocol.io",
//   "max@jetprotocol.io",
//   "james@jetprotocol.io",
//   "eve@infinitylabsnft.com",
//   "justin@honey.land",
//   "corey@honey.land",
//   "brendan@honey.land",
//   "jeff.chen@heir.co",
//   "briana@heir.co",
//   "jeron@heirjordanent.com",
//   "daniel@heirjordanent.com",
//   "rylan.williams@asics.com",
//   "joe.pace@asics.com",
//   "vladimir.garcia@whitetipfire.com",
//   "Nathaniel.Hernandez@lmgsi.net",
//   "Joel.Wild@lmgsi.net",
//   "matty@solana.org",
//   "kellsmonroy@gmail.com",
//   "banana@holaplex.com",
//   "andrew@republic.co",
//   "arjun@paradigm.xyz",
//   "georgios@paradigm.xyz",
//   "morgan.beller@gmail.com",
//   "Sh@faction.vc",
//   "arjun@floodgate.com",
//   "lli@bvp.com",
//   "joe@asymmetric.financial",
//   "jacob.ko84@gmail.com",
//   "phillip@model-no.com",
//   "caelan@br1game.com",
//   "alex@br1game.com",
//   "ccm@campus.io",
//   "coco@nova-labs.com",
//   "abhay@nova-labs.com",
//   "mark@nova-labs.com",
//   "matthew@holaplex.com",
//   "pontus@holaplex.com",
//   "gw@port.finance",
//   "fernanda@decaf.so",
//   "rick@decaf.so",
//   "juan@decaf.so",
//   "scott@decaf.so",
//   "pablo@staratlas.com",
//   "estefan@staratlas.com",
//   "michelle@projectserum.com",
//   "tom@round21.com",
//   "jasmine@round21.com",
//   "Jgbowman97@gmail.com",
//   "zano@jito.wtf",
//   "dao@alenagraff.com",
//   "solquicks@gmail.com",
//   "therealdrthoughtcrime@gmail.com",
//   "chris@dialect.to",
//   "eric@bigbrain.hodings",
//   "ben@bigbrain.holdings",
//   "a@sevensevensix.com",
//   "adam@fb.com",
//   "justin.kan@gmail.com",
//   "dylan@saber.so",
//   "jesper@theportal.to",
//   "chris@theportal.to",
//   "davweber@paypal.com",
//   "teej@mtnpay.so",
//   "nom@monkedao.io",
//   "bruno@magna.so",
//   "amy@ftx.com",
//   "robin@fractal.is",
//   "victoria@fractal.is",
//   "mike@empiredao.xyz",
//   "zack@ribbit.com",
//   "graham@republic.co",
//   "matt@formfunction.xyz",
//   "katherine@formfunction.xyz",
//   "tranquil@matricalabs.io",
//   "olen@matricalabs.io",
//   "John@ninaprotocol.com",
//   "mike@ninaprotocol.com",
//   "dayo@glass.xyz",
//   "sam@glass.xyz",
//   "blockchainbrett@palmtreecrew.com",
//   "austin@palmtreecrew.com",
//   "Delanie@palmtreecrew.com",
//   "martinrivera3@gmail.com",
//   "joshua@hlgflorida.com",
//   "hello@duke-nguyen.com",
//   "info@tonytafuro.com",
//   "han@astralsnft.io",
//   "jesse@brickandtimbercollective.com",
//   "jimmy.wadman@gmail.com",
//   "Pontus@holaplex.com",
//   "Dustin@degen.academy",
//   "solanalegend@protonmail.com",
//   "adam@getbased.com",
//   "chang.daniel98@gmail.com",
//   "hello@joyceliuart.com",
//   "0xmqq@pm.me",
//   "bryan@formfunction.xyz",
//   "magellan@formfunction.xyz",
//   "wayne@goosefx.io",
//   "davidwu@phantom.app",
//   "jburford@protonmail.com",
//   "fxf@753capital.com",
//   "softmoney@netzero.capital",
//   "mike@gm.xyz",
//   "kingz@noovel.co",
//   "patrick.x.rivera@gmail.com",
//   "ryan@iyk.app",
//   "chris@iyk.app",
//   "m.a.adib96@gmail.com",
//   "Rickyjcarvalho@gmail.com",
//   "jai@definitive.fi",
//   "sheraz@solana.com",
//   "divya.agarwalla@solana.com",
//   "josh.fried@solana.com",
//   "casey.furman@verifone.com",
//   "EasyEatsBodega@gmail.com",
//   "Colin.ogoo@solana.org",
//   "nick.schleich@gmail.com",
//   "laurence.a.sabourin@gmail.com",
//   "jadan@miamihackweek.com",
//   "Elise@buildwithtoki.com",
//   "liz.amidon@magiceden.io",
//   "manny@wynwoodbid.com",
//   "hello@justape.co",
//   "danny@justape.co",
//   "james@justape.co",
//   "derek@asymmetric.financial",
//   "edavidmelendez@gmail.com",
//   "jessicajohnsonpr@gmail.com",
//   "p.pires@bel-invest.com",
//   "jlecce@onesothebysrealty.com",
//   "jinasi@thefactoryi.com",
//   "hello@velobru.com",
//   "hello@dnpwl.com",
//   "niroshan@solanaspaces.com",
//   "megan@solanaspaces.com",
//   "cynthia@solanaspaces.com",
//   "daniel@solanaspaces.com",
//   "ross@solanaspaces.com",
//   "katie@solanaspaces.com",
//   "Asha@solanaspaces.com",
//   "vibhu@solanaspaces.com",
//   "carrie@solanaspaces.com",
//   "camille@solanaspaces.com",
//   // "jpbogle22@gmail.com",
//   // "mjordantmac@hotmail.com",
// ];

getLinks(emails, "mainnet")
  .then((links) => {
    console.log(links);
  })
  .catch((e) => {
    console.log(e);
  });

// console.log(
//   Keypair.fromSecretKey(
//     utils.bytes.bs58.decode(
//       "5WYW69wNXJuFq7m7ziZ4HHwSpvQrK9oyibKjHsLX1MvuoX9Zrmtzq2rTLmPaKD7x46s58FVb1tGU5qBUoYNHXRfJ"
//     )
//   ).publicKey.toString()
// );
