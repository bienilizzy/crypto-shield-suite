import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";
import { env } from "../lib/env.js";
import { stripe } from "../lib/stripe.js";
import { updateSubscriptionByCustomerId, upsertSubscriptionByWallet } from "../services/subscriptions.js";

function getId(value: string | { id: string } | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

export async function webhookRoutes(app: FastifyInstance) {
  // Stripe signature verification needs the exact raw request bytes, so this
  // route is registered in its own encapsulated context with a content-type
  // parser that skips JSON parsing - other routes are unaffected.
  await app.register(async (instance) => {
    instance.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
      done(null, body);
    });

    instance.post("/webhooks/stripe", async (req, reply) => {
      const signature = req.headers["stripe-signature"];
      if (!signature || typeof signature !== "string" || !env.stripeWebhookSecret) {
        return reply.code(400).send({ error: "Missing Stripe signature or webhook secret" });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, signature, env.stripeWebhookSecret);
      } catch (err) {
        req.log.error(err, "Stripe webhook signature verification failed");
        return reply.code(400).send({ error: "Invalid signature" });
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const walletAddress = session.client_reference_id ?? session.metadata?.wallet_address;
          const customerId = getId(session.customer);
          const subscriptionId = getId(session.subscription);

          if (walletAddress && customerId) {
            let status = "active";
            let currentPeriodEnd: Date | null = null;

            if (subscriptionId) {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              status = subscription.status;
              currentPeriodEnd = new Date(subscription.current_period_end * 1000);
            }

            await upsertSubscriptionByWallet({
              walletAddress,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId ?? null,
              status,
              currentPeriodEnd,
            });
          }
          break;
        }

        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = getId(subscription.customer);
          if (customerId) {
            await updateSubscriptionByCustomerId({
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
              status: subscription.status,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            });
          }
          break;
        }

        default:
          break;
      }

      return reply.send({ received: true });
    });
  });
}
