import { Finding, TokenSecurityReport } from "@crypto-shield/types";
import { clampScore, scoreToSeverity } from "../scoring.js";

interface TokenRule {
  id: string;
  applies: (report: TokenSecurityReport) => boolean;
  penalty: number;
  title: string;
  description: string;
  recommendation: string;
}

const TOKEN_RULES: TokenRule[] = [
  {
    id: "honeypot",
    applies: (r) => r.isHoneypot,
    penalty: 100,
    title: "Honeypot detected",
    description: "Simulated sells fail or are blocked for this token",
    recommendation: "Do not buy, swap into, or approve this token",
  },
  {
    id: "not-open-source",
    applies: (r) => !r.isOpenSource,
    penalty: 25,
    title: "Contract source is not verified",
    description: "Token contract bytecode could not be matched to verified source code",
    recommendation: "Treat with caution until source code is verified",
  },
  {
    id: "mint-function",
    applies: (r) => r.hasMintFunction && !r.ownershipRenounced,
    penalty: 25,
    title: "Mintable supply with active owner",
    description: "Contract owner can mint new tokens, diluting holders, and ownership has not been renounced",
    recommendation: "Confirm mint authority is restricted or time-locked before holding long-term",
  },
  {
    id: "blacklist-function",
    applies: (r) => r.hasBlacklistFunction,
    penalty: 30,
    title: "Blacklist function present",
    description: "Contract owner can block specific addresses from transferring or selling",
    recommendation: "Be aware the owner can freeze your address from selling",
  },
  {
    id: "no-liquidity-lock",
    applies: (r) => !r.liquidityLocked && !r.lpBurned,
    penalty: 35,
    title: "Liquidity is not locked or burned",
    description: "LP tokens are held by an address that could remove liquidity at any time",
    recommendation: "Avoid until liquidity is locked or LP tokens are burned",
  },
  {
    id: "low-liquidity",
    applies: (r) => (r.liquidityUsd ?? 0) < 5000,
    penalty: 15,
    title: "Very low liquidity",
    description: "Pool liquidity is under $5,000, making the token easy to manipulate or impossible to exit",
    recommendation: "Expect high slippage and price manipulation risk",
  },
  {
    id: "high-tax",
    applies: (r) => (r.buyTaxPercent ?? 0) > 10 || (r.sellTaxPercent ?? 0) > 10,
    penalty: 20,
    title: "High buy/sell tax",
    description: "Buy or sell tax exceeds 10%, reducing realized returns and sometimes indicating a scam fee structure",
    recommendation: "Review tax settings before trading",
  },
];

export function evaluateTokenSecurity(report: TokenSecurityReport): Finding[] {
  const tokenName = report.tokenSymbol ?? report.tokenAddress;

  return TOKEN_RULES.filter((rule) => rule.applies(report)).map((rule) => {
    const score = clampScore(100 - rule.penalty);

    return {
      id: `token-${rule.id}-${report.tokenAddress}`,
      category: "token",
      severity: scoreToSeverity(score),
      score,
      title: `${tokenName}: ${rule.title}`,
      description: rule.description,
      recommendation: rule.recommendation,
      evidence: { tokenAddress: report.tokenAddress, chainId: report.chainId },
    } satisfies Finding;
  });
}
