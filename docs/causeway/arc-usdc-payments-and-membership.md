# Arc USDC Payments and Membership

This document defines the current Causeway implementation for Arc USDC membership payments. It is intentionally separate from the Polymarket trading flow: paying for membership never places a market order and never grants Causeway permission to trade for the user.

## Runtime Decision

Production runtime does not depend on ARC CLI.

The backend verifies payments with a configured Arc RPC endpoint through `viem`. ARC CLI is integrated as an optional project-level development helper for hackathon context sync, local inspection, and retrieving Canteen Arc RPC configuration. It is not part of the application request path and is not required on the API server.

## ARC CLI Development Workflow

The Canteen ARC CLI command is `arc-canteen`. Install it outside the Node dependency tree:

```bash
uv tool install git+https://github.com/the-canteen-dev/ARC-cli.git
```

Project helper commands:

```bash
npm run arc:check
npm run arc:rpc
npm run arc:context
npm run arc:status
npm run arc:cli -- <arc-canteen args>
```

Recommended usage:

1. Run `npm run arc:check` before Arc-specific development.
2. Run `npm run arc:context` when preparing hackathon submissions or refreshing Arc/Circle local context.
3. Run `npm run arc:rpc` to retrieve the Canteen-hosted Arc RPC URL, then copy it into `ARC_RPC_URL`.
4. Keep production deployment independent from the CLI; production should only need `ARC_RPC_URL`, `ARC_CHAIN_ID`, `ARC_USDC_ADDRESS`, and `ARC_PAYMENT_RECEIVER_ADDRESS`.

## Product Scope

- Free users keep the existing core flow.
- Premium membership is stored as a user entitlement.
- The current UI exposes membership purchase and status only; no inference or trading feature is gated yet.
- Future gates should read `GET /membership/me` and check `capabilities.premiumSignals`, `capabilities.fullReasoningTrace`, or `capabilities.arcProof`.

## Chain Payment Flow

1. User connects and signs into Causeway with the existing wallet auth flow.
2. Frontend calls `POST /payments/arc-usdc/intents` with a server-known SKU.
3. Backend creates a pending payment intent with server-side amount, receiver, token, chain id, and expiry.
4. Frontend asks the wallet to switch to Arc Testnet and sends an ERC-20 `transfer(receiver, amountMicroUsd)` using the configured USDC token.
5. Frontend stores the transaction hash locally, then submits it to `POST /payments/arc-usdc/intents/:intentId/verify`.
6. If the receipt is not indexed yet or confirmations are still pending, the frontend retries verification and exposes a resume action after refresh.
7. Backend reads the Arc receipt, verifies chain id, confirmations, successful status, token address, payer address, receiver address, transferred amount, and block timestamp.
8. Backend confirms only transfers whose block timestamp is inside the payment intent window, with a small clock-skew tolerance and a confirmation grace window.
9. Backend marks the intent confirmed and upserts the user's premium membership entitlement.

The backend does not trust client-provided amount, receiver, token, or membership duration.

## API Contract

All endpoints require `Authorization: Bearer <accessToken>`.

### `GET /membership/me`

Returns the current membership state and payment plan metadata.

```ts
type MembershipResponse = {
  tier: "free" | "premium";
  status: "free" | "active" | "expired" | "revoked";
  startsAt: string | null;
  expiresAt: string | null;
  capabilities: {
    premiumSignals: boolean;
    fullReasoningTrace: boolean;
    arcProof: boolean;
  };
  payment: {
    enabled: boolean;
    chainId: number;
    currency: "USDC";
    plans: Array<{
      sku: "premium_monthly" | "premium_yearly";
      label: string;
      amountMicroUsd: string;
      amountUsd: string;
      durationDays: number;
      tier: "premium";
    }>;
  };
  generatedAt: string;
};
```

### `POST /payments/arc-usdc/intents`

Request:

```json
{
  "sku": "premium_monthly"
}
```

Response:

```ts
type ArcPaymentIntent = {
  id: string;
  sku: "premium_monthly" | "premium_yearly";
  status: "pending" | "confirmed" | "expired" | "failed" | "cancelled";
  walletAddress: string;
  txHash: string | null;
  failureReason: string | null;
  expiresAt: string;
  confirmedAt: string | null;
  payment: {
    chainId: number;
    tokenAddress: string;
    receiverAddress: string;
    currency: "USDC";
    decimals: 6;
    amountMicroUsd: string;
    amountUsd: string;
  };
};
```

### `GET /payments/arc-usdc/intents/:intentId`

Returns the user's payment intent. Expired pending intents are marked expired before returning.

### `POST /payments/arc-usdc/intents/:intentId/verify`

Request:

```json
{
  "txHash": "0x..."
}
```

Response:

```ts
type VerifyPaymentResponse = {
  intent: ArcPaymentIntent;
  membership: MembershipResponse;
};
```

## Database

- `ArcPaymentIntent` stores payment intent lifecycle, expected payment parameters, transaction hash, failure reason, and verification metadata.
- `MembershipEntitlement` stores the current premium entitlement per user.
- `MembershipEntitlement.sourcePaymentIntentId` is a nullable foreign key back to the payment intent that funded the current entitlement.
- A transaction hash can confirm only one intent.
- Expired membership is lazily marked `expired` when membership is read.
- Expired payment intents are lazily marked `expired` when a user creates or reads an intent.

## Configuration

```text
ARC_USDC_PAYMENTS_ENABLED=false
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
ARC_PAYMENT_RECEIVER_ADDRESS=
ARC_PAYMENT_INTENT_TTL_MS=900000
ARC_PAYMENT_MIN_CONFIRMATIONS=1
ARC_PREMIUM_MONTHLY_MICRO_USDC=1000000
ARC_PREMIUM_MONTHLY_DAYS=30
ARC_PREMIUM_YEARLY_MICRO_USDC=10000000
ARC_PREMIUM_YEARLY_DAYS=365
```

When `ARC_USDC_PAYMENTS_ENABLED=true`, `ARC_PAYMENT_RECEIVER_ADDRESS` is required. Production should store the receiver private key outside the application and should never use a hot admin wallet as the public receiver when treasury policy requires multi-signature custody.

## Failure Handling

- Missing payment configuration returns `503 CAPABILITY_UNAVAILABLE` or `503 ARC_PAYMENT_RECEIVER_NOT_CONFIGURED`.
- Expired intents return `410 PAYMENT_INTENT_EXPIRED`.
- A transaction that is not found returns `422 PAYMENT_TX_NOT_FOUND`.
- Insufficient confirmations return `409 PAYMENT_CONFIRMATIONS_PENDING`.
- Reused transaction hashes return `409 PAYMENT_TX_ALREADY_USED`.
- Wrong token, wrong payer, wrong receiver, reverted transaction, insufficient amount, historical transaction, or late transaction returns `422 PAYMENT_VERIFICATION_FAILED`.
