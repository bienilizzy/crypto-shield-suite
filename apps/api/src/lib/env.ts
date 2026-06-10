import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://shield:shield@localhost:5432/crypto_shield",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  alchemyApiKey: process.env.ALCHEMY_API_KEY,
  etherscanApiKey: process.env.ETHERSCAN_API_KEY,
  covalentApiKey: process.env.COVALENT_API_KEY,
  goplusAppKey: process.env.GOPLUS_APP_KEY,
  goplusAppSecret: process.env.GOPLUS_APP_SECRET,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePriceId: process.env.STRIPE_PRICE_ID,
  resendApiKey: process.env.RESEND_API_KEY,
  alertFromEmail: process.env.ALERT_FROM_EMAIL,
  cronSecret: process.env.CRON_SECRET,
  tenderly: {
    account: process.env.TENDERLY_ACCOUNT,
    project: process.env.TENDERLY_PROJECT,
    accessKey: process.env.TENDERLY_ACCESS_KEY,
  },
};
