import * as web3 from "@solana/web3.js";
import chalk from "chalk";
import qrcode from "qrcode-terminal";

export default function displayPublicKey(keypair: web3.Keypair) {
  try {
    const publicKey = keypair.publicKey.toString();

    // Display public Key
    console.log(`Public key: ${chalk.underline(publicKey)}`);

    // Generate QR code of the public Key
    qrcode.generate(publicKey, { small: true }, function (qrcode) {
      console.log(qrcode);
    });
  } catch (error) {
    console.error(error.message);
  }
}
