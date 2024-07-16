import inquirer from "inquirer";
import { TokenAccount } from "../types";
import getOwnedTokensData from "../utils/getOwnedTokensData";
import * as web3 from "@solana/web3.js";
import sendSol from "../utils/sendSol";
import chalk from "chalk";
import sendSPLToken from "../utils/sendSPLToken";
export default async function sendTokenSingle(connection: web3.Connection, keypair: web3.Keypair) {
  try {
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

    // Prompt user to receiver address
    const receiverAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "receiverAddress",
        message: "Receiver address:",
      },
    ]);
    const receiverAddress = receiverAnswer.receiverAddress;
    const receiverPubKey = new web3.PublicKey(receiverAddress);
    console.log(`You chose: ${receiverAddress}`);

    // Prompt user to amount
    const amountAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "amount",
        message: "Amount:",
      },
    ]);
    const amount = amountAnswer.amount;
    if (!amount) throw new Error("Invalid amount");
    if (amount > selectedToken.balance) throw new Error("Insufficient balance");

    console.log(`You chose: ${amount}`);

    // Send tokens
    if (selectedToken.name === "SOL") {
      console.log(`Sending ${amount} SOL to ${receiverAddress}...`);
      const signature = await sendSol(keypair, receiverPubKey, connection, amount);

      if (signature) {
        console.log(chalk.green(`Transaction successful: ${signature}`));
      }
    } else {
      console.log(
        `Sending ${amount} ${
          selectedToken.name ? selectedToken.name : selectedToken.pubkey!.toString().slice(0, 5) + "..."
        } to ${receiverAddress}...`
      );
      console.log(
        chalk.dim("If the receiver account does not exist, it will be created. It requires some aditional SOL.")
      );

      const signature = await sendSPLToken(
        keypair,
        receiverPubKey,
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
