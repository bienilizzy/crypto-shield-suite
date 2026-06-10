import type { FastifyInstance } from "fastify";
import type { ApprovalRecord } from "@crypto-shield/types";
import { pool } from "../lib/db.js";
import { env } from "../lib/env.js";
import { fetchApprovals } from "../services/approvalScanner.js";
import { sendEmail } from "../services/emailAlerts.js";
import { isPremium } from "../services/subscriptions.js";

function renderApprovalsEmail(walletAddress: string, chainId: number, approvals: ApprovalRecord[]): string {
  const items = approvals
    .map(
      (approval) =>
        `<li>${approval.tokenSymbol ?? approval.tokenAddress} &rarr; ${approval.spenderLabel ?? approval.spenderAddress} (${
          approval.isUnlimited ? "unlimited" : approval.allowance
        })</li>`,
    )
    .join("");

  return `<p>New token approval(s) detected for <code>${walletAddress}</code> on chain ${chainId}:</p><ul>${items}</ul><p>Review and revoke any you don't recognize in Crypto Shield Suite.</p>`;
}

// Polled by an external scheduler (Railway cron, GitHub Actions, etc.) - see
// DEPLOYMENT.md. Protected by a shared secret since it has no other auth.
export async function cronRoutes(app: FastifyInstance) {
  app.post("/cron/check-approvals", async (req, reply) => {
    const secret = req.headers["x-cron-secret"];
    if (!env.cronSecret || secret !== env.cronSecret) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const { rows: watches } = await pool.query<{ wallet_address: string; chain_id: number; email: string }>(
      `SELECT wallet_address, chain_id, email FROM watched_wallets`,
    );

    let checked = 0;
    let alerted = 0;

    for (const watch of watches) {
      if (!(await isPremium(watch.wallet_address))) continue;
      checked += 1;

      try {
        const approvals = await fetchApprovals(watch.chain_id, watch.wallet_address);

        const { rows: seenRows } = await pool.query<{ token_address: string; spender_address: string }>(
          `SELECT token_address, spender_address FROM seen_approvals WHERE wallet_address = $1 AND chain_id = $2`,
          [watch.wallet_address, watch.chain_id],
        );
        const seen = new Set(
          seenRows.map((row) => `${row.token_address.toLowerCase()}-${row.spender_address.toLowerCase()}`),
        );

        const newApprovals = approvals.filter(
          (approval) => !seen.has(`${approval.tokenAddress.toLowerCase()}-${approval.spenderAddress.toLowerCase()}`),
        );

        for (const approval of approvals) {
          await pool.query(
            `INSERT INTO seen_approvals (wallet_address, chain_id, token_address, spender_address)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [
              watch.wallet_address,
              watch.chain_id,
              approval.tokenAddress.toLowerCase(),
              approval.spenderAddress.toLowerCase(),
            ],
          );
        }

        if (newApprovals.length > 0) {
          alerted += 1;
          await sendEmail({
            to: watch.email,
            subject: `New token approval detected on ${watch.wallet_address}`,
            html: renderApprovalsEmail(watch.wallet_address, watch.chain_id, newApprovals),
          });
        }
      } catch (err) {
        req.log.error(err, `Failed to check approvals for ${watch.wallet_address} on chain ${watch.chain_id}`);
      }
    }

    return reply.send({ checked, alerted });
  });
}
