import { Keypair } from "@solana/web3.js";
import base58 from "bs58";

// Slightly modified version of @solana-developers/helpers getKeypairFromEnvironment function
const getKeypairFromSecretKey = (secretKey: string) => {
  if (!secretKey) {
    throw new Error("Missing secretKey argument");
  }

  // Try the shorter base58 format first
  let decodedSecretKey: Uint8Array;
  try {
    decodedSecretKey = base58.decode(secretKey);
    return Keypair.fromSecretKey(decodedSecretKey);
  } catch (throwObject) {
    const error = throwObject as Error;
    if (!error.message.includes("Non-base58 character")) {
      throw new Error(`Invalid secret key`);
    }
  }

  // Try the longer JSON format
  try {
    decodedSecretKey = Uint8Array.from(JSON.parse(secretKey));
  } catch (error) {
    throw new Error(`Invalid secret key`);
  }
  return Keypair.fromSecretKey(decodedSecretKey);
};
export default getKeypairFromSecretKey;
