import type { ChainId, TokenSecurityReport } from "@crypto-shield/types";

const GOPLUS_BASE_URL = "https://api.gopluslabs.io/api/v1/token_security";

// Addresses commonly used to "burn" ownership/LP tokens. If the contract
// owner or an LP holder is one of these, treat ownership as renounced /
// liquidity as burned.
const BURN_ADDRESSES = new Set([
  "",
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

interface GoPlusDexInfo {
  name?: string;
  liquidity?: string;
  pair?: string;
}

interface GoPlusLpHolder {
  address?: string;
  tag?: string;
  is_locked?: number;
  percent?: string;
}

interface GoPlusTokenSecurityResult {
  token_name?: string;
  token_symbol?: string;
  is_honeypot?: string;
  is_open_source?: string;
  is_mintable?: string;
  is_blacklisted?: string;
  owner_address?: string;
  buy_tax?: string;
  sell_tax?: string;
  dex?: GoPlusDexInfo[];
  lp_holders?: GoPlusLpHolder[];
}

interface GoPlusResponse {
  code: number;
  message: string;
  result?: Record<string, GoPlusTokenSecurityResult>;
}

function isOwnershipRenounced(ownerAddress?: string): boolean {
  return BURN_ADDRESSES.has((ownerAddress ?? "").toLowerCase());
}

// GoPlus reports buy_tax/sell_tax as fractions (e.g. "0.05" = 5%).
function parseTaxPercent(value?: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return undefined;
  return parsed * 100;
}

function sumLiquidityUsd(dex?: GoPlusDexInfo[]): number | undefined {
  if (!dex || dex.length === 0) return undefined;
  return dex.reduce((sum, entry) => sum + (Number(entry.liquidity) || 0), 0);
}

function isLiquidityLocked(lpHolders?: GoPlusLpHolder[]): boolean {
  return (lpHolders ?? []).some((holder) => Number(holder.is_locked) === 1);
}

function isLpBurned(lpHolders?: GoPlusLpHolder[]): boolean {
  return (lpHolders ?? []).some(
    (holder) =>
      holder.tag?.toLowerCase().includes("burn") || BURN_ADDRESSES.has((holder.address ?? "").toLowerCase()),
  );
}

// GoPlus's token_security endpoint is public and works without credentials,
// but is rate-limited per IP. Set GOPLUS_APP_KEY/GOPLUS_APP_SECRET (see
// https://docs.gopluslabs.io/reference/access-token) to mint an access token
// for higher limits if this becomes a bottleneck - not required for the MVP.
export async function fetchTokenSecurity(chainId: ChainId, tokenAddress: string): Promise<TokenSecurityReport> {
  const url = new URL(`${GOPLUS_BASE_URL}/${chainId}`);
  url.searchParams.set("contract_addresses", tokenAddress);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GoPlus request failed: ${res.status}`);
  }

  const body = (await res.json()) as GoPlusResponse;
  if (body.code !== 1 || !body.result) {
    throw new Error(`GoPlus error: ${body.message}`);
  }

  const result = body.result[tokenAddress.toLowerCase()];
  if (!result) {
    throw new Error(`GoPlus has no security data for ${tokenAddress} on chain ${chainId}`);
  }

  return {
    chainId,
    tokenAddress,
    tokenSymbol: result.token_symbol,
    isHoneypot: result.is_honeypot === "1",
    isOpenSource: result.is_open_source === "1",
    ownershipRenounced: isOwnershipRenounced(result.owner_address),
    hasMintFunction: result.is_mintable === "1",
    hasBlacklistFunction: result.is_blacklisted === "1",
    buyTaxPercent: parseTaxPercent(result.buy_tax),
    sellTaxPercent: parseTaxPercent(result.sell_tax),
    liquidityUsd: sumLiquidityUsd(result.dex),
    liquidityLocked: isLiquidityLocked(result.lp_holders),
    lpBurned: isLpBurned(result.lp_holders),
  };
}
