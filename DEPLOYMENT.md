# Deployment guide: Vercel + Railway + Stripe

This app is split across two hosts:

- **`apps/web`** (Next.js dashboard) → **Vercel**
- **`apps/api`** (Fastify API + Postgres + Redis) → **Railway**

Vercel doesn't run long-lived servers with attached databases well, so the
API + Postgres + Redis live on Railway, and Vercel only serves the frontend
and talks to the Railway API over HTTPS.

Two config files are already committed to drive these builds:

- `railway.json` (repo root) — tells Railway how to build/start `apps/api`
  out of this npm-workspaces monorepo.
- `apps/web/vercel.json` — tells Vercel how to build `apps/web` (and its
  `@crypto-shield/types` workspace dependency) when "Root Directory" is set
  to `apps/web`.

---

## 0. Prerequisites

- A GitHub account (Vercel and Railway both deploy from a Git repo)
- A [Vercel](https://vercel.com) account
- A [Railway](https://railway.app) account
- A [Stripe](https://dashboard.stripe.com/register) account
- A [Resend](https://resend.com) account (for the real-time email alerts)

---

## 1. Push the repo to GitHub

```bash
cd /home/adorable/crypto-shield-suite
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/crypto-shield-suite.git
git push -u origin main
```

---

## 2. Deploy the API to Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from
   GitHub repo** → select `crypto-shield-suite`.
2. Railway will detect `railway.json` at the repo root and use it
   automatically:
   - Build: `npm install && npm run build -w @crypto-shield/types && npm run
     build -w @crypto-shield/risk-engine && npm run build -w
     @crypto-shield/api`
   - Start: `node apps/api/dist/index.js`
3. **Add Postgres**: in the project canvas, click **+ New** → **Database** →
   **Add PostgreSQL**.
4. **Add Redis**: click **+ New** → **Database** → **Add Redis**.
5. Open your API service → **Variables** tab and add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable - click "Add Reference") |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
   | `ALCHEMY_API_KEY` | your key |
   | `ETHERSCAN_API_KEY` | your key |
   | `COVALENT_API_KEY` | your key |
   | `GOPLUS_APP_KEY` / `GOPLUS_APP_SECRET` | your keys (optional) |
   | `TENDERLY_ACCOUNT` / `TENDERLY_PROJECT` / `TENDERLY_ACCESS_KEY` | your values (optional) |
   | `STRIPE_SECRET_KEY` | from Stripe (step 3) |
   | `STRIPE_WEBHOOK_SECRET` | from Stripe (step 3) |
   | `STRIPE_PRICE_ID` | from Stripe (step 3) |
   | `RESEND_API_KEY` | from Resend (step 4) |
   | `ALERT_FROM_EMAIL` | from Resend (step 4) |
   | `CRON_SECRET` | any random string, e.g. `openssl rand -hex 32` |

   Railway sets `PORT` automatically — the API already reads
   `process.env.PORT` and binds `0.0.0.0`, so no change needed.

6. **Generate a public domain**: Settings tab → **Networking** → **Generate
   Domain**. You'll get something like
   `https://crypto-shield-api-production.up.railway.app`. This is your **API
   URL** — you'll need it for Vercel, Stripe, and the cron job.
7. **Run the database migration** (creates `subscriptions`,
   `watched_wallets`, `seen_approvals` tables). With the [Railway
   CLI](https://docs.railway.app/guides/cli):

   ```bash
   railway login
   railway link   # select this project/service
   railway run npm run migrate -w @crypto-shield/api
   ```

8. Confirm it's alive: `curl https://<your-api-domain>/health` should return
   `{"status":"ok"}`.

---

## 3. Set up Stripe (subscriptions)

1. In the [Stripe Dashboard](https://dashboard.stripe.com), stay in **Test
   mode** for now.
2. **Product & Price**: Products → **Add product** → name it "Crypto Shield
   Premium", add a recurring price (e.g. $9/month). Copy the **Price ID**
   (`price_...`) → set as `STRIPE_PRICE_ID` on Railway.
3. **Secret key**: Developers → API keys → copy the **Secret key**
   (`sk_test_...`) → set as `STRIPE_SECRET_KEY` on Railway.
4. **Webhook endpoint**: Developers → Webhooks → **Add endpoint**:
   - Endpoint URL: `https://<your-api-domain>/webhooks/stripe`
   - Events to send: `checkout.session.completed`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - After creating it, copy the **Signing secret** (`whsec_...`) → set as
     `STRIPE_WEBHOOK_SECRET` on Railway.
5. Redeploy the Railway service (or it'll pick up the new variables on the
   next deploy/restart).

When you're ready for real payments, repeat steps 2-4 in **Live mode** and
swap the three `STRIPE_*` variables on Railway to the live values.

---

## 4. Set up Resend (real-time approval alerts)

1. Sign up at [resend.com](https://resend.com) and create an **API key** →
   set as `RESEND_API_KEY` on Railway.
2. For `ALERT_FROM_EMAIL`:
   - **Quick test**: use `onboarding@resend.dev` (Resend's shared sandbox
     sender — only delivers to the email address on your Resend account).
   - **Production**: verify your own domain under Domains, then use e.g.
     `alerts@yourdomain.com`.

---

## 5. Deploy the web app to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** →
   import `crypto-shield-suite` from GitHub.
2. Set **Root Directory** to `apps/web`. Vercel will detect the Next.js
   framework and pick up `apps/web/vercel.json`, which overrides the install
   and build commands to run from the monorepo root (so the
   `@crypto-shield/types` workspace package gets built first).
3. **Environment Variables**:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<your-railway-api-domain>` |

4. Click **Deploy**. Once it finishes you'll get a URL like
   `https://crypto-shield-suite.vercel.app`.

The API already has CORS set to reflect any origin (`@fastify/cors` with
`origin: true`), so requests from your Vercel domain (and preview
deployments) work without extra configuration.

---

## 6. Wire up the alerts cron job

Real-time alerts are delivered by `POST /cron/check-approvals` on the API,
protected by the `CRON_SECRET` header. A ready-to-go GitHub Actions workflow
is committed at `.github/workflows/check-approvals-cron.yml` — it runs every
15 minutes.

In your GitHub repo: **Settings → Secrets and variables → Actions → New
repository secret**, add:

- `CRON_API_URL` = `https://<your-railway-api-domain>`
- `CRON_SECRET` = the same value you set on Railway

That's it — the workflow will start running on its schedule once it's on
`main`. You can also trigger it manually from the **Actions** tab
("Run workflow") to test immediately.

---

## 7. Verification checklist

- [ ] `curl https://<api-domain>/health` → `{"status":"ok"}`
- [ ] Open the Vercel URL, connect a wallet, scan an address on a free chain
      (Ethereum or Base) → report renders
- [ ] Switch to a premium chain (Arbitrum, BSC, Polygon) without a
      subscription → scan returns a 402 "premium" error and the chain shows
      `(Premium)` in the dropdown
- [ ] Click **Upgrade to Premium** → completes Stripe Checkout (test card
      `4242 4242 4242 4242`, any future expiry/CVC) → redirected back, page
      shows the **Premium** badge
- [ ] Premium chains now scan successfully; the Revoke button shows
      "Revoke (priority)"
- [ ] In Stripe Dashboard → Webhooks, the `checkout.session.completed` event
      shows a `200` response
- [ ] Enable alerts via the alerts form, then manually trigger the GitHub
      Actions cron workflow → check Resend's dashboard for a sent email (or
      your inbox if a real approval exists)
- [ ] **Manage subscription** opens the Stripe customer portal and
      cancelling it flips `/billing/status/:wallet` back to `isPremium:
      false`

---

## Notes for going further

- **Wallet identity isn't cryptographically verified.** Premium checks use
  an `X-Wallet-Address` header, which any client can set to any value. This
  is fine for an MVP/demo, but before charging real users, add [Sign-In with
  Ethereum (SIWE)](https://docs.login.xyz/) so the API can verify the caller
  actually controls the wallet.
- **Chain tiers changed**: Arbitrum and BSC were previously free and are now
  premium-gated alongside the newly-added Polygon (`PREMIUM_CHAIN_IDS` in
  `packages/types/src/chains.ts`). Ethereum and Base remain free
  (`FREE_CHAIN_IDS`). Adjust these lists if you want a different split.
- **Custom domains**: both Vercel and Railway support adding your own domain
  under their respective project/service settings — update
  `NEXT_PUBLIC_API_URL` and the Stripe webhook URL if you move the API to a
  custom domain.
- **Scaling the cron job**: the GitHub Actions schedule is best-effort and
  can be delayed under high GitHub load. For tighter SLAs, replace it with
  [Railway's cron service type](https://docs.railway.app/reference/cron-jobs)
  pointed at the same `/cron/check-approvals` endpoint.
