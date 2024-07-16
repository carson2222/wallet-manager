import * as web3 from "@solana/web3.js";
import inquirer from "inquirer";
import data from "../../data.json";
import fs from "fs";
export default async function generateNewPrivateKey() {
  const generateNewPrivateKey = await inquirer.prompt({
    type: "input",
    name: "generateNewPrivateKey",
    message: "Generate new private key? (Y/N)",
    validate: (input) => {
      if (input.toLowerCase() === "y" || input.toLowerCase() === "n") {
        return true;
      }
      return "Please enter Y or N";
    },
  });

  if (generateNewPrivateKey.toString().toLowerCase() === "y") {
    const keypair = web3.Keypair.generate();
    data.privateKey = `[${keypair.secretKey.toString()}]`;
    fs.writeFileSync("data.json", JSON.stringify(data));
    console.log("New private key generated and saved in data.json");
    console.log(`Public key of your new wallet: ${keypair.publicKey.toString()}`);
  } else {
    throw new Error("To continue using the app update the private key property in data.json file");
  }
}
