import { Finding, Severity, SimulationResult } from "@crypto-shield/types";
import { evaluateApprovals } from "./approvalRules.js";

export function evaluateSimulation(result: SimulationResult): Finding[] {
  const findings: Finding[] = [];

  if (!result.success) {
    findings.push({
      id: `simulation-revert-${result.chainId}`,
      category: "simulation",
      severity: Severity.Critical,
      score: 0,
      title: "Transaction would revert",
      description: "Simulation indicates this transaction fails on-chain",
      recommendation: "Do not sign this transaction; investigate why it reverts",
      evidence: { chainId: result.chainId },
    });
  }

  // Any approval this transaction would create or modify is scored with the
  // same rules used for a wallet's existing approvals, so a new "unlimited
  // approval to an unverified spender" reads identically wherever it appears.
  findings.push(...evaluateApprovals(result.newApprovals));

  return findings;
}
