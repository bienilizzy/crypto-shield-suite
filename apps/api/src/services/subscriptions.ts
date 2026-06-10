import { pool } from "../lib/db.js";

export interface SubscriptionRecord {
  walletAddress: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodEnd: Date | null;
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

interface SubscriptionRow {
  wallet_address: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  current_period_end: Date | null;
}

function toRecord(row: SubscriptionRow): SubscriptionRecord {
  return {
    walletAddress: row.wallet_address,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
  };
}

export async function getSubscription(walletAddress: string): Promise<SubscriptionRecord | null> {
  const { rows } = await pool.query<SubscriptionRow>(
    `SELECT wallet_address, stripe_customer_id, stripe_subscription_id, status, current_period_end
     FROM subscriptions WHERE wallet_address = $1`,
    [walletAddress.toLowerCase()],
  );

  const row = rows[0];
  return row ? toRecord(row) : null;
}

export async function isPremium(walletAddress: string): Promise<boolean> {
  const subscription = await getSubscription(walletAddress);
  return subscription !== null && ACTIVE_STATUSES.has(subscription.status);
}

export async function upsertSubscriptionByWallet(params: {
  walletAddress: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
  status: string;
  currentPeriodEnd?: Date | null;
}): Promise<void> {
  const { walletAddress, stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd } = params;

  await pool.query(
    `INSERT INTO subscriptions (wallet_address, stripe_customer_id, stripe_subscription_id, status, current_period_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (wallet_address) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
       status = EXCLUDED.status,
       current_period_end = EXCLUDED.current_period_end,
       updated_at = now()`,
    [walletAddress.toLowerCase(), stripeCustomerId, stripeSubscriptionId ?? null, status, currentPeriodEnd ?? null],
  );
}

export async function updateSubscriptionByCustomerId(params: {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: Date | null;
}): Promise<void> {
  const { stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd } = params;

  await pool.query(
    `UPDATE subscriptions SET
       stripe_subscription_id = $2,
       status = $3,
       current_period_end = $4,
       updated_at = now()
     WHERE stripe_customer_id = $1`,
    [stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd],
  );
}
