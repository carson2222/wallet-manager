import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import data from "./data.json";
const readline = require("readline");
const fs = require("fs");
import qrcode from "qrcode-terminal";
import getKeypairFromSecretKey from "./src/getKeypairFromSecretKey";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Metaplex } from "@metaplex-foundation/js";
import { Actions, TokenAccount } from "./types";
import getSPLTokenTicker from "./src/getSPLTokenTicker";
import inquirer from "inquirer";
// import sendSOL from "./src/sendSol";
import chalk from "chalk";
import sendSOL from "./src/sendSol";
import sendSPLToken from "./src/sendSPLToken";

async function main() {
  console.log("Welcome in the wallet manager app");

  if (!data) {
    throw new Error("data.json file couldn't be imported");
  }

  if (!data.rpc) {
    throw new Error("RPC is not specified");
  }
  const connection = new Connection(data.rpc);

  if (!connection) {
    throw new Error("Connection couldn't be established. Check if the RPC is correct");
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
      data.privateKey = `[${keypair.secretKey.toString()}]`;
      fs.writeFileSync("data.json", JSON.stringify(data));
      console.log("New private key generated");
      console.log(`Public key of your new wallet: ` + keypair.publicKey.toString());
    } else {
      console.log("To continue using the app update the private key property in data.json file");
      return;
    }
  }

  ////////////////
  let selectedActionId: number | null = null;
  const actions: Actions[] = [
    { name: "Display your Public Key", id: 1 },
    { name: "Get SOL airdrop (Only posible on devnet)", id: 2 },
    { name: "Display balances", id: 3 },
    { name: "Send token (single)", id: 4 },
    { name: "Send token (bulk)", id: 5 },
  ];
  // Prompt user to select a token
  const choices = actions.map((action) => ({
    name: `${action.id}. ${action.name}`,
    value: action,
  }));

  console.clear();
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "selectedAction",
      message: "Choose an Action:",
      choices: choices,
    },
  ]);

  selectedActionId = answers.selectedAction.id;
  console.log(`You chose: ${answers.selectedAction.name}`);

  ////////////////

  const keypair = getKeypairFromSecretKey(data.privateKey);
  if (selectedActionId === null) throw new Error("Invalid action");

  switch (selectedActionId) {
    case 1:
      try {
        const publicKey = keypair.publicKey.toString();
        const solscanUrl = `https://solscan.io/account/${publicKey}?cluster=devnet`;

        // Display public Key
        console.log(`Public key: ${chalk.underline(publicKey)}`);
        console.log(solscanUrl);

        // Generate QR code of the public Key
        qrcode.generate(solscanUrl, { small: true }, function (qrcode) {
          console.log(qrcode);
        });
      } catch (error) {
        console.error(error.message);
      }
      break;
    case 2:
      try {
        const airdropConnection = new Connection(clusterApiUrl("devnet"));

        console.log("Requesting airdrop...");

        let signature = await airdropConnection.requestAirdrop(keypair.publicKey, LAMPORTS_PER_SOL);
        await airdropConnection.confirmTransaction(signature);
        console.log(chalk.green(`Signature: ${signature}`));
      } catch (error) {
        console.error(error);
      }
      break;
    case 3:
      try {
        const sol_balance = (await connection.getBalance(keypair.publicKey)) / LAMPORTS_PER_SOL;
        const accounts = await connection.getParsedTokenAccountsByOwner(keypair.publicKey, {
          programId: TOKEN_PROGRAM_ID,
        });
        console.log(`SOL balance:\n${sol_balance} SOL`);
        console.log(`\nToken Accounts:`);
        accounts.value.forEach((account, i) => {
          //Parse the account data
          const parsedAccountInfo: any = account.account.data;
          const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
          const tokenBalance: number = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
          //Log results
          console.log(`No. ${i + 1}: ${account.pubkey.toString()}`);
          console.log(`--Token Mint: ${mintAddress}`);
          console.log(`--Token Balance: ${tokenBalance}`);
        });
      } catch (error) {
        console.error(error);
      }
      break;
    case 4:
      try {
        console.log("Fetching available token accounts...");
        const tokensToSend: TokenAccount[] = [];

        //Get SOL balance
        const sol_balance = (await connection.getBalance(keypair.publicKey)) / LAMPORTS_PER_SOL;
        tokensToSend.push({
          name: "SOL",
          balance: sol_balance,
        });

        //Get token accounts
        const accounts = await connection.getParsedTokenAccountsByOwner(keypair.publicKey, {
          programId: TOKEN_PROGRAM_ID,
        });
        await Promise.all(
          accounts.value.map(async (account, i) => {
            const parsedAccountInfo: any = account.account.data;
            const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
            const tokenBalance: number = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
            const tokenDecimals: number = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["decimals"];
            const ticker = await getSPLTokenTicker(connection, new PublicKey(mintAddress));
            tokensToSend.push({
              name: ticker,
              balance: tokenBalance,
              pubkey: new PublicKey(mintAddress),
              decimals: tokenDecimals,
            });
          })
        );

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
        const receiverPubKey = new PublicKey(receiverAddress);
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
          const signature = await sendSOL(keypair, receiverPubKey, connection, amount);

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
            chalk.dim(
              "If the receiver account does not exist, it will be created. It requires some aditional SOL."
            )
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
      break;

    case 5:
      console.log("Fetching available token accounts...");
        const tokensToSend: TokenAccount[] = [];

        

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
        const receiverPubKey = new PublicKey(receiverAddress);
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
          const signature = await sendSOL(keypair, receiverPubKey, connection, amount);

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
            chalk.dim(
              "If the receiver account does not exist, it will be created. It requires some aditional SOL."
            )
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
      break;
    default:
      console.log("Invalid option");
      return;
  }
  try {
  } catch (error) {
    console.error(error.message);
  }
}
main();
