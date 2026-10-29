# Top-up Agent

PayPal AI Hackathon entry. Say how much you want to add, in plain words ("top up $25 for my trip budget"). An AI agent drafts the top-up and shows the cost in dollars. You approve it in PayPal, then press Pay. Nothing is paid without your approval.

**PayPal sandbox only.** No live keys, no real money, no real customer data. This is a standalone demo project, separate from Corso's production code.

## How it works

```
"top up $25 for my trip budget"
        │
        ▼
  Claude (structured output) ──► intent: { topup, $25, "Trip budget" }  (or a follow-up question, or a decline)
        │                         no payment tools: it can only propose
        ▼
  Server prices it ──► limits checked, fee calculated → review card: Top-up $25.00 · Fee $0.00 · Total $25.00
        │
  [Person: "Approve $25.00 and continue to PayPal"]
        ▼
  PayPal Agent Toolkit create_order (sandbox) ──► person approves in PayPal
        ▼
  Server re-checks with get_order: APPROVED, USD, amount matches?
        │
  [Person: "Pay $25.00 now"]
        ▼
  PayPal Agent Toolkit pay_order (capture) ──► Top-up complete
```

| Path | What it does |
|---|---|
| `src/agent.js` | Claude agent (structured outputs) and an offline rules parser used when no Anthropic key is set |
| `src/quote.js` | Turns the intent into a priced quote; enforces limits and fees |
| `src/paypal.js` | PayPal Agent Toolkit Orders tools, pinned to the sandbox |
| `src/app.js` | Express API and the approval state machine |
| `public/` | The web page |
| `test/` | Automated tests (no network: PayPal and Claude are faked) |
| `docs/RULES.md` | Hackathon rules, with sources |
| `docs/SUBMISSION.md` | Draft write-up, judging-criteria mapping, video shot list, what's still needed |

## Run it

Requires Node.js 20.6 or later.

```bash
npm install
cp .env.example .env    # then fill in the sandbox values
npm test                # runs offline
npm run sandbox:check   # optional: checks your PayPal sandbox credentials (creates a $1 order, never captures)
npm start               # http://localhost:3000
```

### Settings (`.env`)

| Variable | Needed? | Notes |
|---|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | For checkout | **Sandbox** app credentials from developer.paypal.com → Apps & Credentials → Sandbox. Without them you can still draft quotes. |
| `PAYPAL_ENVIRONMENT` | No | Must be `sandbox`. Any other value and the app refuses to start. |
| `ANTHROPIC_API_KEY` | For the AI agent | Without it the app uses a simple rules parser, and the page says so. |
| `ANTHROPIC_MODEL` | No | Default `claude-opus-5-5`. |
| `PUBLIC_BASE_URL` | If not on localhost:3000 | PayPal returns the buyer here after approval. |
| `TOPUP_MIN_USD`, `TOPUP_MAX_USD` | No | Default $1 to $500. |
| `TOPUP_SERVICE_FEE_FLAT_USD`, `TOPUP_SERVICE_FEE_PERCENT` | No | Optional fee, shown before approval. Default none. |

### Try a payment

1. In the PayPal developer dashboard, under Sandbox → Accounts, find the sandbox **Personal** (buyer) account and its password.
2. Open http://localhost:3000, type "Top up $25 for my trip budget", and press **Draft my top-up**.
3. Check the amounts, then press **Approve $25.00 and continue to PayPal**.
4. Log in to the PayPal sandbox as the buyer and approve.
5. Back in the app, press **Pay $25.00 now**. The sandbox capture ID is shown, and the payment appears in the sandbox merchant account.

## Safety rules built in

- The language model has no payment tools. It only drafts an intent, which the server re-validates.
- A PayPal order is created only after the person confirms the exact displayed total.
- Payment (capture) happens only after PayPal approval **and** a separate "Pay" press, and only if PayPal's approved amount matches the quote.
- No double capture. Quotes expire after 15 minutes. All money is handled in integer cents.
- The PayPal toolkit is pinned to sandbox, and startup fails if it isn't.
- A payment counts as done only when PayPal reports the **capture itself** as COMPLETED, in USD, for the quoted total. A pending capture, a different amount, or no answer from PayPal puts the top-up in "Check this payment", never "Nothing was paid".
- Quotes are kept in memory. This is a demo, not a production service.

### Known demo limits

Acceptable for a sandbox demo, but they would need fixing before real use:

- **The quote ID is the only credential.** Anyone with the page URL (`?quote=…`) can view, pay or cancel that quote. There are no user accounts.
- `/paypal/return` is a state-changing GET. A third party with the quote URL could push a quote to "failed" (never to "paid").
- An approved-but-unpaid quote (`payer_approved`) does not expire.
- If the buyer presses Back in PayPal and the app sees the order as not approved, the quote ends as failed. Start a new top-up rather than resuming.
- The PayPal Agent Toolkit sends no `PayPal-Request-Id`, so captures aren't idempotent. The app compensates by never retrying a capture: after an error it asks PayPal for the order's state instead.

## Notes

- Secrets live only in `.env`, which is git-ignored. `.env.example` holds placeholders.
- License: MIT (see `LICENSE`). The repo has been public since 2026-10-28.
