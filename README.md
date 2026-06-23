# Chronos

A verified-financials marketplace for acquiring small, owner-operated US businesses from retiring
founders. Every listing's messy owner books are normalized into a defensible **SDE** and **EBITDA**
with an itemized, auditable **add-back schedule**, then human-verified before earning a
"Financials Verified" badge. Full financials and the data room are **gated** behind an NDA and a
proof-of-funds attestation.

See [`SPEC.md`](./SPEC.md) for the product spec and [`CLAUDE.md`](./CLAUDE.md) for conventions and
an orientation to the codebase.

## Tech stack
Next.js (App Router) · TypeScript · Tailwind + shadcn-style UI · Prisma + SQLite · Auth.js
(NextAuth v5, credentials) · Zod · local-disk uploads behind a swappable storage module.

## Prerequisites
- Node.js 20+ (built/tested on Node 22)
- npm

## Install & run
```bash
npm install
npx prisma migrate dev      # create the SQLite db and apply migrations
npm run seed                # seed users + 7 verified listings
npm run dev                 # http://localhost:3000
```

Other commands:
```bash
npm test        # vitest — unit tests for the financial engine
npm run build   # production build + typecheck
```

The `.env` shipped for local dev points `DATABASE_URL` at `file:./dev.db` and sets a dev
`AUTH_SECRET`. Change `AUTH_SECRET` before any real deployment.

## Seed login credentials
All seeded accounts use the password **`password123`**.

| Role   | Email                     |
| ------ | ------------------------- |
| ADMIN  | `admin@chronos.test`   |
| SELLER | `seller1@chronos.test` |
| SELLER | `seller2@chronos.test` |
| BUYER  | `buyer1@chronos.test`  |
| BUYER  | `buyer2@chronos.test`  |

You can also register new BUYER/SELLER accounts from the sign-in page.

## End-to-end happy path
1. **Seller lists** — sign in as `seller1@chronos.test`, click *List a business*, complete the
   wizard (profile → 3 years of financials → add-backs → review). The listing is created as a
   DRAFT; open it, upload a supporting doc, and *Submit for verification*.
2. **Admin verifies** — sign in as `admin@chronos.test`, open *Admin* → verification queue.
   Review the normalized SDE/EBITDA derivation, the add-back schedule, and any flags
   (uncategorized or >15%-of-revenue add-backs), then *Verify & publish* (or reject with notes).
3. **Buyer discovers & unlocks** — sign in as `buyer1@chronos.test`, *Browse*, filter by
   industry / state / revenue / SDE / price / multiple. Open a listing (teaser metrics only),
   accept the NDA and attest proof of funds to submit an unlock request.
4. **Admin approves** the unlock request from the Admin dashboard.
5. **Buyer views & messages** — the buyer now sees the full itemized financials, the 3-year trend,
   the data room, and a private deal room to message the seller.

## How the financial engine works
The core lives in [`src/lib/financials.ts`](./src/lib/financials.ts) — a pure, fully unit-tested
module:

- **SDE** = net profit + owner salary + total add-backs (interest, taxes and D&A are handled as
  add-back categories).
- **EBITDA** = net profit + interest + taxes + depreciation + amortization (owner-comp and other
  discretionary add-backs are excluded).
- **Multiples** = asking price ÷ SDE, and asking price ÷ EBITDA.
- Every figure is returned itemized so the UI renders exactly how it was derived — never just a
  final number.
- Add-back categories are validated against an enum; uncategorized add-backs and any add-back
  exceeding 15% of revenue raise a warning the admin sees during verification.

## Notes / out of scope
Payments, escrow, KYC, bank-verified funds, e-signature, and outbound email are intentionally not
built. Proof of funds is self-attested, the NDA is a timestamped checkbox, and email notifications
are logged to the server console (`[email] …`).
