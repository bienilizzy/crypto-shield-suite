import type { FastifyInstance } from "fastify";
import { buildRiskReport, evaluateTokenSecurity } from "@crypto-shield/risk-engine";
import { fetchTokenSecurity } from "../services/rugPullDetector.js";

export async function tokenRoutes(app: FastifyInstance) {
  app.get<{ Params: { chainId: string; address: string } }>(
    "/token/:chainId/:address",
    async (req, reply) => {
      const chainId = Number(req.params.chainId);
      const { address } = req.params;

      const security = await fetchTokenSecurity(chainId, address);
      const findings = evaluateTokenSecurity(security);
      const report = buildRiskReport(address, "token", findings);

      return reply.send({ security, report });
    },
  );
}
