import { createJupiterApiClient, QuoteGetRequest } from "@jup-ag/api";
import { Wallet } from "@project-serum/anchor";
import * as web3 from "@solana/web3.js";
import { Token, TokenAccount } from "../types";
import getOwnedTokensData from "../utils/getOwnedTokensData";
import inquirer from "inquirer";
import getSignature from "../utils/getSignature";
import { transactionSenderAndConfirmationWaiter } from "../utils/transactionSender";
import chalk from "chalk";

export default async function swapTokens(connection: web3.Connection, keypair: web3.Keypair) {
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
}
