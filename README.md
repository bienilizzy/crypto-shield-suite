# Crypto Shield Suite

Unified wallet/contract security dashboard: approval scanner + risk scoring,
rug pull detector, and transaction simulator. See the architecture/MVP plan
for the full design.

## Layout

- `apps/api` — Fastify orchestrator API (`/approvals`, `/token`, `/simulate`, `/report`, `/billing`, `/alerts`, `/cron`, `/webhooks`)
- `apps/web` — Next.js dashboard (single search box -> composite risk report)
- `packages/types` — shared TypeScript types (`ApprovalRecord`, `Finding`, `RiskReport`, `CHAINS`, ...)
- `packages/risk-engine` — shared scoring rules (`evaluateApprovals`, `evaluateTokenSecurity`, `evaluateSimulation`, `buildRiskReport`)

## Premium (Stripe subscriptions)

Premium status is tied to a connected wallet address (Stripe Checkout +
webhooks, see `apps/api/src/routes/billing.ts` and `webhooks.ts`). Free
chains are Ethereum and Base; Arbitrum, BSC, and Polygon require Premium
(`packages/types/src/chains.ts`). Premium also unlocks:

- Real-time email alerts for new approvals (`/alerts`, `/cron/check-approvals`)
- A boosted EIP-1559 priority fee on revoke transactions (`RevokeButton.tsx`)

## Data sources

- `approvalScanner.ts` — Etherscan v2 unified API (`getLogs` for
  Approval/ApprovalForAll events + `eth_call` for live
  allowance/isApprovedForAll/symbol). Requires `ETHERSCAN_API_KEY`.
- `rugPullDetector.ts` — GoPlus Security `token_security` API (public,
  unauthenticated; `GOPLUS_APP_KEY`/`GOPLUS_APP_SECRET` are reserved for an
  access-token flow if rate limits become an issue).
- `spenderRegistry.ts` — risk-tags approval spenders. "Verified" comes from a
  small hand-maintained map of major DEX routers. "Malicious" comes from
  ScamSniffer's open-source [scam-database](https://github.com/scamsniffer/scam-database)
  blocklist (cached in Redis, 6h TTL). Note: the canonical RevokeCash
  spender-registry repo doesn't exist as a standalone package, so
  ScamSniffer's list is used as the malicious-address source instead.
- `txSimulator.ts` — still mocked; see its `TODO` comment for wiring up
  Tenderly.

The web app (`apps/web`) connects a wallet via wagmi/viem (injected
connector) and the "Revoke" button on each approval row calls
`approve(spender, 0)` (ERC20) or `setApprovalForAll(spender, false)`
(ERC721/1155) directly from the user's wallet.

## Local setup

```bash
npm install
docker compose up -d        # postgres + redis for local dev

npm run build -w @crypto-shield/types
npm run build -w @crypto-shield/risk-engine

npm run dev:api              # http://localhost:4000
npm run dev:web              # http://localhost:3000
```

Copy `.env.example` to `.env` (api) and `apps/web/.env.local.example` to
`apps/web/.env.local` and fill in API keys as integrations are added.

## Environment notes

- This repo lives under a `\\wsl.localhost\...` path. Windows' `npm` has a
  bug creating workspace symlinks over that UNC path (`EISDIR` on
  `npm install`) — run `npm install` from inside WSL (`wsl -d Ubuntu`)
  instead of from PowerShell/Git Bash.
- The API's `dev` script intentionally avoids `tsx`/`esbuild`: the bundled
  `esbuild` binary segfaults under this WSL kernel. It uses `tsc --watch` +
  `node --watch dist/index.js` instead. Next.js (SWC, Rust-based) is unaffected.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step instructions to deploy
`apps/web` to Vercel and `apps/api` (+ Postgres + Redis) to Railway, plus
Stripe and Resend setup for the premium features.
