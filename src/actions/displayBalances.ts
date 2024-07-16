import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as web3 from "@solana/web3.js";
import getSPLTokenTicker from "../utils/getSPLTokenTicker";
import chalk from "chalk";
export default async function displayBalances(connection: web3.Connection, keypair: web3.Keypair) {
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
      console.log(chalk.bold(`No. ${Number(i) + 1}: ${tokenTicker !== undefined ? tokenTicker : mintAddress}`));
      console.log(`--Token Mint: ${mintAddress}`);
      console.log(`--Token Balance: ${tokenBalance}`);
    }
  } catch (error) {
    console.error(error);
  }
}
