import type { FastifyInstance } from "fastify";
import { buildRiskReport, evaluateSimulation } from "@crypto-shield/risk-engine";
import type { SimulationRequest } from "@crypto-shield/types";
import { simulateTransaction } from "../services/txSimulator.js";

export async function simulateRoutes(app: FastifyInstance) {
  app.post<{ Body: SimulationRequest }>("/simulate", async (req, reply) => {
    const result = await simulateTransaction(req.body);
    const findings = evaluateSimulation(result);
    const report = buildRiskReport(req.body.to, "transaction", findings);

    return reply.send({ result, report });
  });
}
