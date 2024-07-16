import { Metaplex } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";

async function getSPLTokenTicker(connection: Connection, mintAddress: PublicKey) {
  const metaplex = Metaplex.make(connection);

  let tokenSymbol;

  const metadataAccount = metaplex.nfts().pdas().metadata({ mint: mintAddress });

  const metadataAccountInfo = await connection.getAccountInfo(metadataAccount);

  if (metadataAccountInfo) {
    const token = await metaplex.nfts().findByMint({ mintAddress: mintAddress });
    tokenSymbol = token.symbol;
  }
  return tokenSymbol;
}
export default getSPLTokenTicker;
