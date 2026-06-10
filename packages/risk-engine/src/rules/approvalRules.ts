import { ApprovalRecord, Finding } from "@crypto-shield/types";
import { clampScore, scoreToSeverity } from "../scoring.js";

/**
 * Scores a single token approval. Score starts at 100 (no concern) and is
 * reduced for each risk factor present. A malicious spender short-circuits
 * to 0 regardless of other factors.
 */
export function evaluateApproval(approval: ApprovalRecord): Finding {
  const reasons: string[] = [];
  let score = 100;

  if (approval.spenderRiskTag === "malicious") {
    score = 0;
    reasons.push("Spender address is on a known malicious-contract list");
  } else {
    if (approval.isUnlimited) {
      score -= 40;
      reasons.push(
        approval.tokenType === "ERC20"
          ? "Unlimited token allowance granted"
          : "Unlimited operator approval (setApprovalForAll) granted",
      );
    }

    if (approval.spenderRiskTag === "unknown" || approval.spenderRiskTag === undefined) {
      score -= 30;
      reasons.push("Spender contract is not in the verified-protocol registry");
    }
  }

  score = clampScore(score);
  const severity = scoreToSeverity(score);
  const spenderName = approval.spenderLabel ?? approval.spenderAddress;
  const tokenName = approval.tokenSymbol ?? approval.tokenAddress;

  return {
    id: `approval-${approval.chainId}-${approval.tokenAddress}-${approval.spenderAddress}`,
    category: "approval",
    severity,
    score,
    title: `${tokenName} approval to ${spenderName}`,
    description: reasons.length > 0 ? reasons.join("; ") : "No issues detected",
    recommendation: severity === "safe" ? undefined : `Revoke ${tokenName} approval to ${spenderName}`,
    evidence: { approval },
  };
}

export function evaluateApprovals(approvals: ApprovalRecord[]): Finding[] {
  return approvals.map(evaluateApproval);
}
