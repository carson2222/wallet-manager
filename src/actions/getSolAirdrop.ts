import * as web3 from "@solana/web3.js";
import chalk from "chalk";
export default async function getSolAirdrop(keypair: web3.Keypair) {
  try {
    const airdropConnection = new web3.Connection(web3.clusterApiUrl("devnet"));

    console.log("Requesting airdrop...");

    let signature = await airdropConnection.requestAirdrop(keypair.publicKey, web3.LAMPORTS_PER_SOL);
    await airdropConnection.confirmTransaction(signature);
    console.log(chalk.green(`Signature: ${signature}`));
  } catch (error) {
    console.error(error);
  }
}
