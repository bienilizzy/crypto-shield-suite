export * from "./chains.js";

// Chain identifiers (EVM chain IDs). Extend as new chains are supported.
export type ChainId = 1 | 8453 | 42161 | 56 | 137 | number;

export type SubjectType = "wallet" | "token" | "transaction";

export type FindingCategory = "approval" | "token" | "simulation";

export enum Severity {
  Safe = "safe",
  Caution = "caution",
  Risky = "risky",
  Critical = "critical",
}

export type SpenderRiskTag = "verified" | "unknown" | "malicious";

export type TokenStandard = "ERC20" | "ERC721" | "ERC1155";

/** A single risk-engine finding. score is 0-100, where 100 = no concern. */
export interface Finding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  score: number;
  title: string;
  description: string;
  recommendation?: string;
  evidence?: Record<string, unknown>;
}

export interface ApprovalRecord {
  chainId: ChainId;
  ownerAddress: string;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenType: TokenStandard;
  spenderAddress: string;
  spenderLabel?: string;
  spenderRiskTag?: SpenderRiskTag;
  /** Raw allowance as a base-10 string (uint256). For ERC721/1155 operator approvals, "1" means approved. */
  allowance: string;
  isUnlimited: boolean;
  lastUpdatedBlock?: number;
}

export interface TokenSecurityReport {
  chainId: ChainId;
  tokenAddress: string;
  tokenSymbol?: string;
  isHoneypot: boolean;
  isOpenSource: boolean;
  ownershipRenounced: boolean;
  hasMintFunction: boolean;
  hasBlacklistFunction: boolean;
  buyTaxPercent?: number;
  sellTaxPercent?: number;
  liquidityUsd?: number;
  liquidityLocked: boolean;
  liquidityLockExpiresAt?: string;
  lpBurned: boolean;
}

export interface SimulationRequest {
  chainId: ChainId;
  from: string;
  to: string;
  data: string;
  value?: string;
}

export interface TokenTransfer {
  tokenAddress: string;
  from: string;
  to: string;
  amount: string;
}

export interface SimulationResult {
  chainId: ChainId;
  success: boolean;
  newApprovals: ApprovalRecord[];
  tokenTransfers: TokenTransfer[];
  touchedTokenAddresses: string[];
  rawTraceUrl?: string;
}

export interface RiskReport {
  subject: string;
  subjectType: SubjectType;
  overallScore: number;
  severity: Severity;
  findings: Finding[];
  recommendations: string[];
  generatedAt: string;
}
