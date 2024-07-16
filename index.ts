import * as web3 from "@solana/web3.js";
import data from "./data.json";
const readline = require("readline");
const fs = require("fs");
import qrcode from "qrcode-terminal";
import getKeypairFromSecretKey from "./src/getKeypairFromSecretKey";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Actions, Token, TokenAccount } from "./types";
import inquirer from "inquirer";
import chalk from "chalk";
import sendSol from "./src/sendSol";
import sendSPLToken from "./src/sendSPLToken";
import getOwnedTokensData from "./src/getOwnedTokensData";
import sendSolBulk from "./src/sendSolBulk";
import sendSPLTokenBulk from "./src/sendSPLTokenBulk";
import { createJupiterApiClient, QuoteGetRequest } from "@jup-ag/api";
import { Wallet } from "@project-serum/anchor";
import getSignature from "./src/getSignature";
import { transactionSenderAndConfirmationWaiter } from "./src/transactionSender";
import getSPLTokenTicker from "./src/getSPLTokenTicker";

async function main() {
  console.log("Welcome in the wallet manager app");

  if (!data) {
    throw new Error("data.json file couldn't be imported");
  }

  if (!data.rpc) {
    throw new Error("RPC is not specified");
  }
  const connection = new web3.Connection(data.rpc);

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
      const keypair = web3.Keypair.generate();
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
    { name: "Swap tokens (via Jup.ag) (mainnet only)", id: 6 },
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
        const airdropConnection = new web3.Connection(web3.clusterApiUrl("devnet"));

        console.log("Requesting airdrop...");

        let signature = await airdropConnection.requestAirdrop(keypair.publicKey, web3.LAMPORTS_PER_SOL);
        await airdropConnection.confirmTransaction(signature);
        console.log(chalk.green(`Signature: ${signature}`));
      } catch (error) {
        console.error(error);
      }
      break;
    case 3:
      try {
        const sol_balance = (await connection.getBalance(keypair.publicKey)) / web3.LAMPORTS_PER_SOL;
        const accounts = await connection.getParsedTokenAccountsByOwner(keypair.publicKey, {
          programId: TOKEN_PROGRAM_ID,
        });
        console.log(`SOL balance:\n${sol_balance} SOL`);
        console.log(`\nToken Accounts:`);
        for (const i in accounts.value) {
          //Parse the account data
          const account = accounts.value[i];
          const parsedAccountInfo: any = account.account.data;
          const mintAddress: string = parsedAccountInfo["parsed"]["info"]["mint"];
          const tokenBalance: number = parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];
          const tokenTicker = await getSPLTokenTicker(connection, new web3.PublicKey(mintAddress));
          //Log results
          console.log(
            chalk.bold(`No. ${Number(i) + 1}: ${tokenTicker !== undefined ? tokenTicker : mintAddress}`)
          );
          console.log(`--Token Mint: ${mintAddress}`);
          console.log(`--Token Balance: ${tokenBalance}`);
        }
      } catch (error) {
        console.error(error);
      }
      break;
    case 4:
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
            chalk.dim(
              "If the receiver account does not exist, it will be created. It requires some aditional SOL."
            )
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
      break;
    case 6:
      try {
        const jupiterQuoteApi = createJupiterApiClient();
        const wallet = new Wallet(keypair);
        let fromToken: TokenAccount;
        let toToken: web3.PublicKey;
        let amount: number;
        let maxAutoSlippage: number;

        const popularTokens: Token[] = [
          {
            name: "SOL",
            mint: "So11111111111111111111111111111111111111112",
          },
          {
            name: "USDC",
            mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          },
          {
            name: "USDT",
            mint: "Es9vMFrzaCERmJfrF4HsPFWGCsXMwsQQswUxhE81CFDu",
          },
        ];

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
        fromToken = tokenAnswer.selectedToken;
        if (fromToken.name === "SOL") {
          fromToken.pubkey = new web3.PublicKey("So11111111111111111111111111111111111111112");
        }
        // Prompt user to select a received token
        const toTokenAnswer = await inquirer.prompt([
          {
            type: "list",
            name: "toToken",
            message: "Select a token to receive",
            choices: [
              ...popularTokens.map((token) => ({
                name: token.name,
                value: token,
              })),
              {
                name: "Other",
                value: "other",
              },
            ],
          },
        ]);

        if (toTokenAnswer.toToken === "other") {
          const otherTokenAnswer = await inquirer.prompt([
            {
              type: "input",
              name: "mint",
              message: "Enter custom token mint to receive",
            },
          ]);
          const { mint } = otherTokenAnswer;
          toToken = new web3.PublicKey(mint);
        } else {
          const { mint } = toTokenAnswer.toToken;
          toToken = new web3.PublicKey(mint);
        }

        // Prompt user to enter amount
        const amountAnswer = await inquirer.prompt([
          {
            type: "input",
            name: "amount",
            message: "Enter amount to send",
            default: fromToken.balance.toString(),
          },
        ]);
        amount = amountAnswer.amount;
        if (!amount) throw new Error("Invalid amount");

        // Prompt user to enter max auto slippage
        const maxAutoSlippageAnswer = await inquirer.prompt([
          {
            type: "input",
            name: "maxAutoSlippage",
            message: "Enter max auto slippage (in %, e.g. 10 for 10%)",
            default: "10",
          },
        ]);
        maxAutoSlippage = maxAutoSlippageAnswer.maxAutoSlippage;
        if (!maxAutoSlippage) throw new Error("Invalid max auto slippage");

        // Get Quote
        const params: QuoteGetRequest = {
          inputMint: fromToken.pubkey!.toString(),
          outputMint: toToken.toString(),
          amount: fromToken.name === "SOL" ? amount * web3.LAMPORTS_PER_SOL : amount * 10 ** fromToken.decimals!,
          autoSlippage: true,
          autoSlippageCollisionUsdValue: 1_000,
          maxAutoSlippageBps: maxAutoSlippage * 100,
          minimizeSlippage: true,
          onlyDirectRoutes: false,
          asLegacyTransaction: false,
        };
        const quote = await jupiterQuoteApi.quoteGet(params);
        if (!quote) {
          throw new Error("Unable to quote");
        }
        const swapObj = await jupiterQuoteApi.swapPost({
          swapRequest: {
            quoteResponse: quote,
            userPublicKey: wallet.publicKey.toBase58(),
            dynamicComputeUnitLimit: true,
            prioritizationFeeLamports: "auto",
          },
        });
        // Serialize the transaction
        const swapTransactionBuf = Buffer.from(swapObj.swapTransaction, "base64");
        var transaction = web3.VersionedTransaction.deserialize(swapTransactionBuf);
        // Sign the transaction
        transaction.sign([wallet.payer]);
        const signature = getSignature(transaction);
        // Simulate the transaction
        const { value: simulatedTransactionResponse } = await connection.simulateTransaction(transaction, {
          replaceRecentBlockhash: true,
          commitment: "processed",
        });

        const { err, logs } = simulatedTransactionResponse;
        if (err) {
          throw new Error("Simulation error: " + JSON.stringify(err));
        }
        const serializedTransaction = Buffer.from(transaction.serialize());
        const blockhash = transaction.message.recentBlockhash;
        const transactionResponse = await transactionSenderAndConfirmationWaiter({
          connection,
          serializedTransaction,
          blockhashWithExpiryBlockHeight: {
            blockhash,
            lastValidBlockHeight: swapObj.lastValidBlockHeight,
          },
        });
        if (!transactionResponse) {
          throw new Error("Transaction not confirmed");
        }
        if (transactionResponse.meta?.err) {
          throw new Error("Transaction error: " + transactionResponse.meta.err);
        }
        console.log(chalk.green(`Swap successful: ${signature}`));
      } catch (error) {
        console.error(error);
        console.error(error.message);
      }
      break;
    default:
      console.log("Invalid option");
      return;
  }
  try {
  } catch (error) {
    console.error(error);
    console.error(error.message);
  }
}
main();
