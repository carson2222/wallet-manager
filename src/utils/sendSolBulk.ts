import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as web3 from "@solana/web3.js";

async function sendSolBulk(
  fromKeyPair: Keypair,
  toPubKey: PublicKey[],
  connection: Connection,
  amount: number,
  NUM_DROPS_PER_TX: number = 10,
  TX_INTERVAL: number = 1000
) {
  const signatures: string[] = [];
  const dropsAmount = Math.ceil(toPubKey.length / NUM_DROPS_PER_TX);

  for (let i = 0; i < dropsAmount; i++) {
    const transaction = new web3.Transaction();
    for (let j = 0; j < NUM_DROPS_PER_TX; j++) {
      const index = i * NUM_DROPS_PER_TX + j;
      if (index < toPubKey.length) {
        transaction.add(
          web3.SystemProgram.transfer({
            fromPubkey: fromKeyPair.publicKey,
            toPubkey: toPubKey[index],
            lamports: amount * web3.LAMPORTS_PER_SOL,
          })
        );
      }
    }
    const signature = await web3.sendAndConfirmTransaction(connection, transaction, [fromKeyPair]);
    signatures.push(signature);
    await new Promise((resolve) => setTimeout(resolve, TX_INTERVAL));
  }

  return signatures;
}

export default sendSolBulk;
