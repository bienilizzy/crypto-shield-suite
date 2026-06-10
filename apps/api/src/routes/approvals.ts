import type { FastifyInstance } from "fastify";
import { buildRiskReport, evaluateApprovals } from "@crypto-shield/risk-engine";
import { assertChainAccess } from "../lib/premiumGate.js";
import { fetchApprovals } from "../services/approvalScanner.js";

export async function approvalsRoutes(app: FastifyInstance) {
  app.get<{ Params: { chainId: string; address: string } }>(
    "/approvals/:chainId/:address",
    async (req, reply) => {
      const chainId = Number(req.params.chainId);
      const { address } = req.params;

      await assertChainAccess(req, chainId);

      const approvals = await fetchApprovals(chainId, address);
      const findings = evaluateApprovals(approvals);
      const report = buildRiskReport(address, "wallet", findings);

      return reply.send({ approvals, report });
    },
  );
}
