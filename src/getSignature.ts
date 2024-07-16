import bs58 from "bs58";
import * as web3 from "@solana/web3.js";

function getSignature(transaction: web3.Transaction | web3.VersionedTransaction): string {
  const signature = "signature" in transaction ? transaction.signature : transaction.signatures[0];
  if (!signature) {
    throw new Error("Missing transaction signature, the transaction was not signed by the fee payer");
  }
  return bs58.encode(signature);
}

export default getSignature;
