import type { FastifyInstance } from "fastify";
import { env } from "../lib/env.js";
import { stripe } from "../lib/stripe.js";
import { getSubscription, isPremium } from "../services/subscriptions.js";

interface CheckoutBody {
  walletAddress: string;
  successUrl: string;
  cancelUrl: string;
}

interface PortalBody {
  walletAddress: string;
  returnUrl: string;
}

export async function billingRoutes(app: FastifyInstance) {
  // Creates a Stripe Checkout session for the Premium subscription. The
  // wallet address (not an account/email) is the identity premium status is
  // tied to - see services/subscriptions.ts.
  app.post<{ Body: CheckoutBody }>("/billing/checkout", async (req, reply) => {
    const { walletAddress, successUrl, cancelUrl } = req.body ?? {};
    if (!walletAddress || !successUrl || !cancelUrl) {
      return reply.code(400).send({ error: "walletAddress, successUrl, and cancelUrl are required" });
    }
    if (!env.stripePriceId) {
      return reply.code(500).send({ error: "STRIPE_PRICE_ID is not configured" });
    }

    const wallet = walletAddress.toLowerCase();
    const existing = await getSubscription(wallet);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: wallet,
      customer: existing?.stripeCustomerId ?? undefined,
      line_items: [{ price: env.stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: { wallet_address: wallet },
      },
      metadata: { wallet_address: wallet },
    });

    return reply.send({ url: session.url });
  });

  // Stripe-hosted portal for managing/cancelling an existing subscription.
  app.post<{ Body: PortalBody }>("/billing/portal", async (req, reply) => {
    const { walletAddress, returnUrl } = req.body ?? {};
    if (!walletAddress || !returnUrl) {
      return reply.code(400).send({ error: "walletAddress and returnUrl are required" });
    }

    const subscription = await getSubscription(walletAddress.toLowerCase());
    if (!subscription?.stripeCustomerId) {
      return reply.code(404).send({ error: "No billing account found for this wallet" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return reply.send({ url: session.url });
  });

  app.get<{ Params: { walletAddress: string } }>("/billing/status/:walletAddress", async (req, reply) => {
    const { walletAddress } = req.params;
    const [premium, subscription] = await Promise.all([
      isPremium(walletAddress),
      getSubscription(walletAddress),
    ]);

    return reply.send({
      isPremium: premium,
      status: subscription?.status ?? "inactive",
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    });
  });
}
