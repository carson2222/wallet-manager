import { PublicKey } from "@solana/web3.js";

export interface TokenAccount {
  pubkey?: PublicKey;
  name: string;
  balance: number;
  decimals?: number;
}

export interface Actions {
  name: string;
  id: number;
}

export interface Token {
  name: string;
  mint: string;
}
