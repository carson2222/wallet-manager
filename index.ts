import { Keypair } from "@solana/web3.js";
import data from "./data.json";
const readline = require("readline");
const fs = require("fs");
async function main() {
  console.log("Welcome in the wallet manager app");

  if (!data) {
    throw new Error("data.json file couldn't be imported");
  }

  console.log(data);
  if (!data.rpc) {
    throw new Error("RPC is not specified");
  }

  if (!data.privateKey) {
    console.log("Private key is not specified");
    console.log("Would you like to generate a new one?");

    const answer = await new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question("Generate new private key? (Y/N) ", (answer) => {
        rl.close();
        resolve(answer);
      });
    });
    if (typeof answer == "string" && answer.toLowerCase() === "y") {
      console.log("Generating new private key...");
      const keypair = Keypair.generate();
      data.privateKey = keypair.secretKey.toString();
      fs.writeFileSync("data.json", JSON.stringify(data));
      console.log("New private key generated");
      console.log(`Public key of your new wallet: ` + keypair.publicKey.toString());
    } else {
      console.log("To continue using the app update the private key property in data.json file");
      return;
    }
  }

  try {
  } catch (error) {
    console.error(error.message);
  }
}
main();
