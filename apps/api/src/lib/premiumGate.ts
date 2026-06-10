import type { FastifyRequest } from "fastify";
import { isPremiumChain } from "@crypto-shield/types";
import { isPremium } from "../services/subscriptions.js";

export class PremiumRequiredError extends Error {
  statusCode = 402;

  constructor(message: string) {
    super(message);
    this.name = "PremiumRequiredError";
  }
}

// Chains outside the free tier (Ethereum + Base) require an active
// subscription. The caller's wallet is identified via the `x-wallet-address`
// header, which is NOT cryptographically verified - this blocks casual
// access but not a forged header. A production deployment should replace
// this with a signed-message (SIWE) session before relying on it for billing
// enforcement.
export async function assertChainAccess(req: FastifyRequest, chainId: number): Promise<void> {
  if (!isPremiumChain(chainId)) return;

  const walletAddress = req.headers["x-wallet-address"];
  if (!walletAddress || typeof walletAddress !== "string") {
    throw new PremiumRequiredError(
      "This chain is a premium feature. Connect a wallet with an active subscription.",
    );
  }

  if (!(await isPremium(walletAddress))) {
    throw new PremiumRequiredError("This chain is a premium feature. Upgrade to access it.");
  }
}
