import { createTransferInstruction, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";

async function sendSPLToken(
  fromKeyPair: Keypair,
  toWalletPubKey: PublicKey,
  tokenMint: PublicKey,
  connection: Connection,
  amount: number,
  decimals: number
) {
  const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    fromKeyPair,
    tokenMint,
    fromKeyPair.publicKey
  );

  const toTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    fromKeyPair,
    tokenMint,
    toWalletPubKey
  );

  const transaction = new Transaction();

  transaction.add(
    createTransferInstruction(
      fromTokenAccount.address,
      toTokenAccount.address,
      fromKeyPair.publicKey,
      amount * Math.pow(10, decimals)
    )
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [fromKeyPair]);
  return signature;
}

export default sendSPLToken;
