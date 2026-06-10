import type { ChainId, SpenderRiskTag } from "@crypto-shield/types";
import { redis } from "../lib/redis.js";

// ScamSniffer's open-source scam database: a chain-agnostic list of addresses
// associated with confirmed drainers/scams. https://github.com/scamsniffer/scam-database
const MALICIOUS_ADDRESS_LIST_URL =
  "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json";
const MALICIOUS_CACHE_KEY = "registry:malicious-spenders";
const MALICIOUS_CACHE_TTL_SECONDS = 6 * 60 * 60;

export interface SpenderInfo {
  name?: string;
  riskTag: SpenderRiskTag;
}

// Audited, widely-used router/protocol contracts. Approvals to these are
// scored as "verified" instead of "unknown". Extend as new protocols/chains
// are supported.
const VERIFIED_SPENDERS = new Map<ChainId, Map<string, string>>([
  [
    1,
    new Map([
      ["0x7a250d5630b4cf539739df2c5dacb4c659f2488d", "Uniswap V2 Router"],
      ["0xe592427a0aece92de3edee1f18e0157c05861564", "Uniswap V3 Router"],
      ["0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45", "Uniswap Universal Router"],
      ["0x1111111254eeb25477b68fb85ed929f73a960582", "1inch v5 Router"],
      ["0xdef1c0ded9bec7f1a1670819833240f027b25eff", "0x Exchange Proxy"],
    ]),
  ],
  [
    8453,
    new Map([["0x2626664c2603336e57b271c5c0b26f421741e481", "Uniswap V3 Router (Base)"]]),
  ],
  [
    42161,
    new Map([["0x1111111254eeb25477b68fb85ed929f73a960582", "1inch v5 Router (Arbitrum)"]]),
  ],
  [
    56,
    new Map([["0x10ed43c718714eb63d5aa57b78b54704e256024e", "PancakeSwap Router"]]),
  ],
]);

let maliciousAddresses: Set<string> | undefined;
let maliciousAddressesPromise: Promise<Set<string>> | undefined;

async function loadMaliciousAddresses(): Promise<Set<string>> {
  if (maliciousAddresses) return maliciousAddresses;
  if (maliciousAddressesPromise) return maliciousAddressesPromise;

  maliciousAddressesPromise = (async () => {
    const cached = await redis.get(MALICIOUS_CACHE_KEY).catch(() => null);
    if (cached) {
      const set = new Set<string>(JSON.parse(cached) as string[]);
      maliciousAddresses = set;
      return set;
    }

    try {
      const res = await fetch(MALICIOUS_ADDRESS_LIST_URL);
      if (!res.ok) throw new Error(`status ${res.status}`);

      const addresses = (await res.json()) as string[];
      const set = new Set(addresses.map((address) => address.toLowerCase()));
      maliciousAddresses = set;

      await redis
        .set(MALICIOUS_CACHE_KEY, JSON.stringify(addresses), "EX", MALICIOUS_CACHE_TTL_SECONDS)
        .catch(() => undefined);

      return set;
    } catch (err) {
      console.error("Failed to load malicious spender list:", err);
      const empty = new Set<string>();
      maliciousAddresses = empty;
      return empty;
    }
  })();

  return maliciousAddressesPromise;
}

export async function getSpenderInfo(chainId: ChainId, spenderAddress: string): Promise<SpenderInfo> {
  const address = spenderAddress.toLowerCase();

  const verifiedName = VERIFIED_SPENDERS.get(chainId)?.get(address);
  if (verifiedName) {
    return { name: verifiedName, riskTag: "verified" };
  }

  const malicious = await loadMaliciousAddresses();
  if (malicious.has(address)) {
    return { riskTag: "malicious" };
  }

  return { riskTag: "unknown" };
}
