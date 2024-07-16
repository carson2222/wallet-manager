import * as web3 from "@solana/web3.js";
import data from "../../data.json";
import { TokenAccount } from "../../types";
import getOwnedTokensData from "../utils/getOwnedTokensData";
import inquirer from "inquirer";
import sendSolBulk from "../utils/sendSolBulk";
import chalk from "chalk";
import sendSPLTokenBulk from "../utils/sendSPLTokenBulk";
export default async function sendTokenBulk(connection: web3.Connection, keypair: web3.Keypair) {
  try {
    // Load receiver's public keys
    console.log("Fetching receivers' public keys...");
    if (data.bulkWallets.length === 0) {
      throw new Error("bulkWallets in data.json file is empty. Add at least one address to it.");
    }
    const receiverPubKeys: web3.PublicKey[] = [];
    for (const address of data.bulkWallets) {
      receiverPubKeys.push(new web3.PublicKey(address));
    }
    console.log(`Loaded ${receiverPubKeys.length} receivers`);

    // Fetch available token accounts
    console.log("Fetching available token accounts...");
    const tokensToSend: TokenAccount[] = await getOwnedTokensData(connection, keypair);

    // Display finish message
    if (tokensToSend.length > 0) {
      console.log(`Loaded ${tokensToSend.length} tokens`);
    }

    // Prompt user to select a token
    const choices = tokensToSend.map((token) => ({
      name: `${token.name ? token.name : "SPL token"} - ${token.balance} ${
        token.pubkey ? "- " + token.pubkey.toString() : ""
      }`,
      value: token,
    }));

    const tokenAnswer = await inquirer.prompt([
      {
        type: "list",
        name: "selectedToken",
        message: "Choose a token:",
        choices: choices,
      },
    ]);
    const selectedToken: TokenAccount = tokenAnswer.selectedToken;
    console.log(`You chose: ${selectedToken.name || selectedToken.pubkey?.toString()}`);

    // Prompt user to amount
    const amountAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "amount",
        message: "Amount to be send to EACH wallet:",
      },
    ]);
    const amount = amountAnswer.amount;
    if (!amount) throw new Error("Invalid amount");
    if (amount > selectedToken.balance) throw new Error("Insufficient balance");

    console.log(`You chose: ${amount}`);

    // Send tokens
    if (selectedToken.name === "SOL") {
      console.log(`Sending ${amount} SOL to ${receiverPubKeys.length} wallets...`);
      const signature = await sendSolBulk(keypair, receiverPubKeys, connection, amount);

      if (signature) {
        console.log(chalk.green(`Transaction successful: ${signature}`));
      }
    } else {
      console.log(
        `Sending ${amount} ${
          selectedToken.name ? selectedToken.name : selectedToken.pubkey!.toString().slice(0, 5) + "..."
        } to ${receiverPubKeys.length} wallets...`
      );
      console.log(
        chalk.dim("If the receiver account does not exist, it will be created. It requires some aditional SOL.")
      );

      const signature = await sendSPLTokenBulk(
        keypair,
        receiverPubKeys,
        selectedToken.pubkey!,
        connection,
        amount,
        selectedToken.decimals!
      );
      if (signature) {
        console.log(chalk.green(`Transaction successful: ${signature}`));
      }
    }
  } catch (error) {
    console.error(error.message);
  }
}
