import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { TokenAccount } from "../../types";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import getSPLTokenTicker from "./getSPLTokenTicker";

async function getOwnedTokensData(connection: Connection, owner: Keypair): Promise<TokenAccount[]> {
  const tokens: TokenAccount[] = [];

  const solBalance = (await connection.getBalance(owner.publicKey)) / LAMPORTS_PER_SOL;
  tokens.push({
    name: "SOL",
    balance: solBalance,
  });

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner.publicKey, {
    programId: TOKEN_PROGRAM_ID,
  });

  for (const account of tokenAccounts.value) {
    if (!account || !account.account.data.parsed || !account.account.data.parsed.info) {
      continue;
    }

    const { mint, tokenAmount } = account.account.data.parsed.info;
    const mintAddress = mint.toString();
    const tokenBalance = tokenAmount.uiAmount;
    const tokenDecimals = tokenAmount.decimals;
    try {
      const ticker = await getSPLTokenTicker(connection, new PublicKey(mintAddress));
      tokens.push({
        name: ticker,
        balance: tokenBalance,
        pubkey: new PublicKey(mintAddress),
        decimals: tokenDecimals,
      });
    } catch (error) {
      console.error(`Failed to get ticker for mint ${mintAddress}:`, error);
    }
  }

  return tokens;
}

export default getOwnedTokensData;
