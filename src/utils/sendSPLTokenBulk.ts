import { createTransferInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";

async function sendSPLTokenBulk(
  fromKeyPair: Keypair,
  toPubKey: PublicKey[],
  tokenMint: PublicKey,
  connection: Connection,
  amount: number,
  decimals: number,
  NUM_DROPS_PER_TX: number = 10,
  TX_INTERVAL: number = 1000
) {
  const signatures: string[] = [];
  const dropsAmount = Math.ceil(toPubKey.length / NUM_DROPS_PER_TX);

  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    fromKeyPair,
    tokenMint,
    fromKeyPair.publicKey
  );

  for (let i = 0; i < dropsAmount; i++) {
    const transaction = new Transaction();
    for (let j = 0; j < NUM_DROPS_PER_TX; j++) {
      const index = i * NUM_DROPS_PER_TX + j;
      if (index < toPubKey.length) {
        const toTokenAccount = await getOrCreateAssociatedTokenAccount(
          connection,
          fromKeyPair,
          tokenMint,
          toPubKey[index]
        );

        transaction.add(
          createTransferInstruction(
            fromTokenAccount.address,
            toTokenAccount.address,
            fromKeyPair.publicKey,
            amount * Math.pow(10, decimals)
          )
        );
      }
    }

    const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeyPair]);
    signatures.push(signature);
    await new Promise((resolve) => setTimeout(resolve, TX_INTERVAL));
  }

  return signatures;
}

export default sendSPLTokenBulk;
