export interface ChainInfo {
  id: number;
  name: string;
}

export const CHAINS: ChainInfo[] = [
  { id: 1, name: "Ethereum" },
  { id: 8453, name: "Base" },
  { id: 42161, name: "Arbitrum" },
  { id: 56, name: "BNB Chain" },
  { id: 137, name: "Polygon" },
];

// Free tier covers Ethereum + Base. The remaining chains require an active
// premium subscription (see apps/api/src/lib/premiumGate.ts).
export const FREE_CHAIN_IDS: number[] = [1, 8453];
export const PREMIUM_CHAIN_IDS: number[] = [42161, 56, 137];

export function isPremiumChain(chainId: number): boolean {
  return PREMIUM_CHAIN_IDS.includes(chainId);
}
