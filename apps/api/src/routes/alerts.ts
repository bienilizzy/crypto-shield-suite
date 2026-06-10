import type { FastifyInstance } from "fastify";
import { pool } from "../lib/db.js";
import { isPremium } from "../services/subscriptions.js";

interface WatchBody {
  walletAddress: string;
  chainId: number;
  email: string;
}

interface UnwatchBody {
  walletAddress: string;
  chainId: number;
}

// Real-time alerts: premium users register a (wallet, chain, email) tuple
// here, and the /cron/check-approvals job emails them when a new approval
// shows up for that wallet.
export async function alertsRoutes(app: FastifyInstance) {
  app.post<{ Body: WatchBody }>("/alerts/watch", async (req, reply) => {
    const { walletAddress, chainId, email } = req.body ?? {};
    if (!walletAddress || !chainId || !email) {
      return reply.code(400).send({ error: "walletAddress, chainId, and email are required" });
    }

    if (!(await isPremium(walletAddress))) {
      return reply.code(402).send({ error: "Real-time alerts are a premium feature. Upgrade to enable them." });
    }

    await pool.query(
      `INSERT INTO watched_wallets (wallet_address, chain_id, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet_address, chain_id) DO UPDATE SET email = EXCLUDED.email`,
      [walletAddress.toLowerCase(), chainId, email],
    );

    return reply.send({ watching: true });
  });

  app.get<{ Params: { walletAddress: string } }>("/alerts/watch/:walletAddress", async (req, reply) => {
    const { rows } = await pool.query<{ chain_id: number; email: string }>(
      `SELECT chain_id, email FROM watched_wallets WHERE wallet_address = $1`,
      [req.params.walletAddress.toLowerCase()],
    );

    return reply.send({
      watches: rows.map((row) => ({ chainId: row.chain_id, email: row.email })),
    });
  });

  app.delete<{ Body: UnwatchBody }>("/alerts/watch", async (req, reply) => {
    const { walletAddress, chainId } = req.body ?? {};
    if (!walletAddress || !chainId) {
      return reply.code(400).send({ error: "walletAddress and chainId are required" });
    }

    await pool.query(`DELETE FROM watched_wallets WHERE wallet_address = $1 AND chain_id = $2`, [
      walletAddress.toLowerCase(),
      chainId,
    ]);

    return reply.send({ watching: false });
  });
}
