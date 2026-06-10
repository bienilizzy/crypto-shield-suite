import Stripe from "stripe";
import { env } from "./env.js";

// Falls back to a placeholder so importing this module doesn't crash the
// process when STRIPE_SECRET_KEY isn't configured (e.g. local dev without
// billing). Routes that actually call Stripe should check env.stripeSecretKey
// first and return a clear error if it's missing.
export const stripe = new Stripe(env.stripeSecretKey || "sk_test_not_configured");
