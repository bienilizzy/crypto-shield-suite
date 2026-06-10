import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./lib/env.js";
import { alertsRoutes } from "./routes/alerts.js";
import { approvalsRoutes } from "./routes/approvals.js";
import { billingRoutes } from "./routes/billing.js";
import { cronRoutes } from "./routes/cron.js";
import { reportRoutes } from "./routes/report.js";
import { simulateRoutes } from "./routes/simulate.js";
import { tokenRoutes } from "./routes/token.js";
import { webhookRoutes } from "./routes/webhooks.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok" }));

// Webhook routes are registered first since they need a raw-body content
// type parser scoped to their own encapsulation context.
await app.register(webhookRoutes);

await app.register(approvalsRoutes);
await app.register(tokenRoutes);
await app.register(simulateRoutes);
await app.register(reportRoutes);
await app.register(billingRoutes);
await app.register(alertsRoutes);
await app.register(cronRoutes);

try {
  await app.listen({ port: env.port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
