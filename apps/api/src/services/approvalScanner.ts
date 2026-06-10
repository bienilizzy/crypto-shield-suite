import {
  type Address,
  type Hex,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  erc721Abi,
  toEventSelector,
} from "viem";
import type { ApprovalRecord, ChainId, TokenStandard } from "@crypto-shield/types";
import { env } from "../lib/env.js";
import { getSpenderInfo } from "./spenderRegistry.js";

const ETHERSCAN_BASE_URL = "https://api.etherscan.io/v2/api";

// ERC20 Approval(owner, spender, value) and ERC721/1155 ApprovalForAll(owner,
// operator, approved) topic0 hashes, computed at runtime so they stay correct
// if viem's keccak implementation changes.
const APPROVAL_TOPIC = toEventSelector("Approval(address,address,uint256)");
const APPROVAL_FOR_ALL_TOPIC = toEventSelector("ApprovalForAll(address,address,bool)");

// Allowances at or above this are treated as "unlimited" for risk-scoring
// purposes. Wallets commonly approve max uint256, but some approve large
// round numbers (e.g. 1e30) that aren't literally MAX_UINT256.
const UNLIMITED_THRESHOLD = 2n ** 96n;

interface EtherscanLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
}

interface EtherscanResponse<T> {
  status: string;
  message: string;
  result: T;
}

interface EtherscanProxyResponse {
  jsonrpc: string;
  id: number;
  result?: Hex;
  error?: { code: number; message: string };
}

async function etherscanRequest<T>(chainId: ChainId, params: Record<string, string>): Promise<T> {
  if (!env.etherscanApiKey) {
    throw new Error("ETHERSCAN_API_KEY is not configured");
  }

  const url = new URL(ETHERSCAN_BASE_URL);
  url.searchParams.set("chainid", String(chainId));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("apikey", env.etherscanApiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Etherscan request failed: ${res.status}`);
  }

  const body = (await res.json()) as EtherscanResponse<T>;
  // getLogs reports status "0" with message "No records found" for an empty
  // (but successful) result set - that's not an error.
  if (body.status === "0" && body.message !== "No records found") {
    throw new Error(`Etherscan error: ${body.message}`);
  }

  return body.result;
}

async function ethCall(chainId: ChainId, to: Address, data: Hex): Promise<Hex> {
  if (!env.etherscanApiKey) {
    throw new Error("ETHERSCAN_API_KEY is not configured");
  }

  const url = new URL(ETHERSCAN_BASE_URL);
  url.searchParams.set("chainid", String(chainId));
  url.searchParams.set("module", "proxy");
  url.searchParams.set("action", "eth_call");
  url.searchParams.set("to", to);
  url.searchParams.set("data", data);
  url.searchParams.set("tag", "latest");
  url.searchParams.set("apikey", env.etherscanApiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Etherscan eth_call failed: ${res.status}`);
  }

  const body = (await res.json()) as EtherscanProxyResponse;
  if (body.error) {
    throw new Error(`Etherscan eth_call error: ${body.error.message}`);
  }
  if (!body.result) {
    throw new Error("Etherscan eth_call returned no result");
  }

  return body.result;
}

function addressToTopic(address: string): Hex {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}` as Hex;
}

function topicToAddress(topic: string): Address {
  return `0x${topic.slice(-40)}` as Address;
}

async function fetchApprovalLogs(chainId: ChainId, topic0: Hex, ownerTopic: Hex): Promise<EtherscanLog[]> {
  return etherscanRequest<EtherscanLog[]>(chainId, {
    module: "logs",
    action: "getLogs",
    fromBlock: "0",
    toBlock: "latest",
    topic0,
    topic1: ownerTopic,
    topic0_1_opr: "and",
  });
}

async function getAllowance(chainId: ChainId, token: Address, owner: Address, spender: Address): Promise<bigint> {
  const data = encodeFunctionData({ abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
  const result = await ethCall(chainId, token, data);
  return decodeFunctionResult({ abi: erc20Abi, functionName: "allowance", data: result });
}

async function getIsApprovedForAll(
  chainId: ChainId,
  token: Address,
  owner: Address,
  operator: Address,
): Promise<boolean> {
  const data = encodeFunctionData({ abi: erc721Abi, functionName: "isApprovedForAll", args: [owner, operator] });
  const result = await ethCall(chainId, token, data);
  return decodeFunctionResult({ abi: erc721Abi, functionName: "isApprovedForAll", data: result });
}

async function getSymbol(chainId: ChainId, token: Address): Promise<string | undefined> {
  try {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: "symbol" });
    const result = await ethCall(chainId, token, data);
    return decodeFunctionResult({ abi: erc20Abi, functionName: "symbol", data: result });
  } catch {
    return undefined;
  }
}

interface ApprovalPair {
  tokenAddress: Address;
  spenderAddress: Address;
  lastUpdatedBlock: number;
}

// Collapse the (potentially many) historical Approval/ApprovalForAll logs for
// an owner down to the latest token+spender pairs. The actual current
// allowance/approval state is then re-checked live via eth_call, since a log
// only reflects the value at the time it was emitted.
function dedupePairs(logs: EtherscanLog[]): ApprovalPair[] {
  const pairs = new Map<string, ApprovalPair>();

  for (const log of logs) {
    const tokenAddress = log.address as Address;
    const spenderAddress = topicToAddress(log.topics[2]);
    const blockNumber = parseInt(log.blockNumber, 16);
    const key = `${tokenAddress.toLowerCase()}-${spenderAddress.toLowerCase()}`;

    const existing = pairs.get(key);
    if (!existing || existing.lastUpdatedBlock < blockNumber) {
      pairs.set(key, { tokenAddress, spenderAddress, lastUpdatedBlock: blockNumber });
    }
  }

  return [...pairs.values()];
}

async function buildErc20Approval(
  chainId: ChainId,
  owner: Address,
  pair: ApprovalPair,
): Promise<ApprovalRecord | null> {
  try {
    const [allowance, symbol, spenderInfo] = await Promise.all([
      getAllowance(chainId, pair.tokenAddress, owner, pair.spenderAddress),
      getSymbol(chainId, pair.tokenAddress),
      getSpenderInfo(chainId, pair.spenderAddress),
    ]);

    if (allowance === 0n) return null;

    return {
      chainId,
      ownerAddress: owner,
      tokenAddress: pair.tokenAddress,
      tokenSymbol: symbol,
      tokenType: "ERC20",
      spenderAddress: pair.spenderAddress,
      spenderLabel: spenderInfo.name,
      spenderRiskTag: spenderInfo.riskTag,
      allowance: allowance.toString(),
      isUnlimited: allowance >= UNLIMITED_THRESHOLD,
      lastUpdatedBlock: pair.lastUpdatedBlock,
    };
  } catch (err) {
    console.error(`Failed to resolve ERC20 approval ${pair.tokenAddress} -> ${pair.spenderAddress}:`, err);
    return null;
  }
}

async function buildOperatorApproval(
  chainId: ChainId,
  owner: Address,
  pair: ApprovalPair,
): Promise<ApprovalRecord | null> {
  try {
    const [isApproved, symbol, spenderInfo] = await Promise.all([
      getIsApprovedForAll(chainId, pair.tokenAddress, owner, pair.spenderAddress),
      getSymbol(chainId, pair.tokenAddress),
      getSpenderInfo(chainId, pair.spenderAddress),
    ]);

    if (!isApproved) return null;

    // ApprovalForAll is emitted by both ERC721 and ERC1155 contracts and the
    // revoke call (setApprovalForAll(operator, false)) is identical for both,
    // so we don't probe ERC165 to disambiguate - "ERC721" is used as the
    // default tokenType label for operator-style approvals.
    const tokenType: TokenStandard = "ERC721";

    return {
      chainId,
      ownerAddress: owner,
      tokenAddress: pair.tokenAddress,
      tokenSymbol: symbol,
      tokenType,
      spenderAddress: pair.spenderAddress,
      spenderLabel: spenderInfo.name,
      spenderRiskTag: spenderInfo.riskTag,
      allowance: "1",
      isUnlimited: true,
      lastUpdatedBlock: pair.lastUpdatedBlock,
    };
  } catch (err) {
    console.error(`Failed to resolve operator approval ${pair.tokenAddress} -> ${pair.spenderAddress}:`, err);
    return null;
  }
}

export async function fetchApprovals(chainId: ChainId, ownerAddress: string): Promise<ApprovalRecord[]> {
  const owner = ownerAddress as Address;
  const ownerTopic = addressToTopic(owner);

  const [erc20Logs, operatorLogs] = await Promise.all([
    fetchApprovalLogs(chainId, APPROVAL_TOPIC, ownerTopic),
    fetchApprovalLogs(chainId, APPROVAL_FOR_ALL_TOPIC, ownerTopic),
  ]);

  const erc20Pairs = dedupePairs(erc20Logs);
  const operatorPairs = dedupePairs(operatorLogs);

  const [erc20Approvals, operatorApprovals] = await Promise.all([
    Promise.all(erc20Pairs.map((pair) => buildErc20Approval(chainId, owner, pair))),
    Promise.all(operatorPairs.map((pair) => buildOperatorApproval(chainId, owner, pair))),
  ]);

  return [...erc20Approvals, ...operatorApprovals].filter((approval): approval is ApprovalRecord => approval !== null);
}
