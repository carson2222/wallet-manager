import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as web3 from "@solana/web3.js";

async function sendSOL(fromKeyPair: Keypair, toPubKey: PublicKey, connection: Connection, amount: number) {
  const transaction = new web3.Transaction();
  transaction.add(
    web3.SystemProgram.transfer({
      fromPubkey: fromKeyPair.publicKey,
      toPubkey: toPubKey,
      lamports: amount * web3.LAMPORTS_PER_SOL,
    })
  );
  const signature = await web3.sendAndConfirmTransaction(connection, transaction, [fromKeyPair]);
  return signature;
}

export default sendSOL;
