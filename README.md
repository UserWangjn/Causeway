# Causeway

Causeway is prediction-market infrastructure for turning one market thesis into a connected market graph, AI-assisted causal reasoning, and guarded order previews.

The product is built around a simple idea: prediction markets are networks. A move in one Polymarket outcome can affect related markets, competing outcomes, and downstream event paths. Causeway helps users explore those links before they trade.

## Live Links

- Website: https://causeway.market
- App: https://causeway.market/app
- Whitepaper: https://causeway.market/whitepaper.pdf
- Docs: https://causeway.market/docs/

## What It Does

- Syncs Polymarket markets, outcomes, order books, and portfolio context.
- Displays a market-network view for browsing related events and categories.
- Runs AI inference from a selected root market into candidate related markets.
- Generates causal scripts, graph views, and tradable order candidates.
- Keeps order execution behind explicit wallet review and user signatures.
- Supports account, position, open-order, and local order-history views.
- Serves a standalone marketing page and whitepaper from the static frontend.

## Repository Layout

```text
.
|-- src/                 # React/Vite frontend app
|-- apps/api/            # NestJS API, Prisma schema, tests, integrations
|-- public/marketing/    # Static marketing entry
|-- public/docs/         # Static docs/whitepaper entry
|-- public/whitepaper/   # Public whitepaper PDF
|-- public/assets/       # Static marketing assets
|-- scripts/dev/         # Local helper scripts
`-- dist/                # Production build output, generated locally
```

## Tech Stack

- Frontend: React 19, Vite, TypeScript, Wagmi, RainbowKit, React Query, XYFlow.
- Backend: NestJS, Prisma, PostgreSQL, BullMQ/Redis optional scheduling, Vitest.
- Market integrations: Polymarket Gamma, CLOB, Data API, Builder/Relayer flows.
- AI integration: configurable OpenAI-compatible inference endpoint.
- Deployment: static frontend on Cloudflare Pages, API as a Node/NestJS service.

## Local Development

Install dependencies:

```bash
npm install
```

Create local environment files from the examples:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
```

Start the frontend:

```bash
npm run dev:web
```

Start the API in another terminal:

```bash
npm run dev:api
```

The app defaults to:

- Frontend: http://localhost:5173
- API: http://localhost:8000/api/v1

Open the app at:

```text
http://localhost:5173/app
```

## Environment Configuration

Root frontend variables:

```text
VITE_API_BASE_URL=
VITE_WALLETCONNECT_PROJECT_ID=
VITE_ARC_RPC_URL=
ARC_RPC_URL=
```

API variables live in `apps/api/.env`. At minimum, configure:

```text
DATABASE_URL=
JWT_SECRET=
INTERNAL_API_TOKEN=
API_CORS_ORIGINS=
```

Real trading, AI inference, Polymarket credentials, payment settings, Redis, and rate limiting are configured through the additional variables documented in `apps/api/.env.example`.

Never commit real secrets, private keys, API tokens, wallet credentials, database passwords, or production `.env` files.

## Database

Generate the Prisma client:

```bash
npm run db:generate
```

Run local migrations:

```bash
npm run db:migrate
```

For production-style deploys, use:

```bash
npm run db:deploy
```

## Market Sync

After the API is running and `INTERNAL_API_TOKEN` is set, trigger an incremental market sync:

```bash
INTERNAL_API_TOKEN=your-local-token npm run sync:polymarket
```

PowerShell:

```powershell
$env:INTERNAL_API_TOKEN="your-local-token"
npm run sync:polymarket
Remove-Item Env:INTERNAL_API_TOKEN
```

## Build And Quality

Build frontend and API:

```bash
npm run build
```

Frontend only:

```bash
npm run build:web
```

API only:

```bash
npm run build:api
```

Run lint checks:

```bash
npm run lint
```

Run API tests:

```bash
npm run test:api
```

## Deployment Notes

The production deployment is split:

- Static frontend and marketing pages are built into `dist/` and deployed to Cloudflare Pages.
- Backend API runs as a separate Node/NestJS service with its own environment, database, and process manager.
- `VITE_API_BASE_URL` must point the built frontend at the deployed API base URL.
- `/whitepaper.pdf` redirects to the current PDF under `public/whitepaper/`.

Example frontend build for production:

```bash
VITE_API_BASE_URL=https://api.example.com npm run build:web
```

## Security Notes

- Real orders are disabled unless `ENABLE_REAL_ORDERS=true` is set on the API.
- Wallet signatures are required for trading credentials, approvals, transfers, and order submission.
- Public repositories must only contain example config, static assets, and non-sensitive source code.
- Keep Cloudflare tokens, Polymarket credentials, database URLs, JWT secrets, and wallet-related secrets outside Git.

## License

No open-source license has been declared yet. All rights are reserved unless a license file is added.
