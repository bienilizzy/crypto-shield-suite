import type { FastifyInstance } from "fastify";
import { buildRiskReport, evaluateApprovals, evaluateTokenSecurity } from "@crypto-shield/risk-engine";
import type { Finding } from "@crypto-shield/types";
import { assertChainAccess } from "../lib/premiumGate.js";
import { fetchApprovals } from "../services/approvalScanner.js";
import { fetchTokenSecurity } from "../services/rugPullDetector.js";

// Orchestrator endpoint: runs the Approval Scanner against `address` as a
// wallet, then runs the Rug Pull Detector against every token it has
// approved, merging both into one composite report.
//
// TODO (Week 4): classify `address` as EOA vs. contract via eth_getCode and
// branch to the token-only or simulation flows per the architecture doc.
export async function reportRoutes(app: FastifyInstance) {
  app.get<{ Params: { chainId: string; address: string } }>(
    "/report/:chainId/:address",
    async (req, reply) => {
      const chainId = Number(req.params.chainId);
      const { address } = req.params;

      await assertChainAccess(req, chainId);

      const approvals = await fetchApprovals(chainId, address);
      const findings: Finding[] = [...evaluateApprovals(approvals)];

      const tokenAddresses = [...new Set(approvals.map((approval) => approval.tokenAddress))];
      for (const tokenAddress of tokenAddresses) {
        const security = await fetchTokenSecurity(chainId, tokenAddress);
        findings.push(...evaluateTokenSecurity(security));
      }

      const report = buildRiskReport(address, "wallet", findings);

      return reply.send({ approvals, report });
    },
  );
}
