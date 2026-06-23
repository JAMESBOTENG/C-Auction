# SPEC — "Chronos": a verified-financials marketplace for SMB acquisitions

## Context
A web marketplace for buying/selling small, owner-operated US businesses whose founders are
retiring with no successor (the "silver tsunami"). Generic listing sites do NOT verify financials
and bury good deals under junk. Our wedge is TRUSTWORTHY, STANDARDIZED FINANCIALS: every listing's
messy owner books are normalized into a defensible SDE and EBITDA with an itemized, auditable
add-back schedule, plus a human verification workflow. Buyers are first-time acquirers / search-fund
operators who want clean, comparable, gated financials.

## MVP scope (all built)
1. Auth with three roles: BUYER, SELLER (owner or broker), ADMIN.
2. Seller flow: multi-step listing wizard — business profile + structured financials intake
   (3 years of revenue, COGS, opex line items, owner salary, and add-backs each with
   {label, amount, category, note}).
3. Financial normalization engine (the core — see `src/lib/financials.ts`).
4. Verification workflow: seller uploads supporting docs; ADMIN reviews in a queue and sets
   status DRAFT → PENDING_REVIEW → VERIFIED (or REJECTED with notes). VERIFIED listings show a
   "Financials Verified" badge.
5. Buyer flow: browse + search + filter (industry, state, revenue range, SDE range, asking price,
   multiple). Cards show teaser metrics only; full financials and data room are GATED. To unlock,
   a buyer accepts an NDA (checkbox + timestamp) and submits a proof-of-funds attestation
   (amount + source). On admin approval, financials + data room unlock for that buyer.
6. Listing detail: headline metrics, normalized SDE/EBITDA, asking multiples, full itemized
   add-back schedule (once unlocked), 3-year trend, reason-for-sale, verified badge.
7. Per-deal "deal room": document list + threaded messages between buyer and seller.
8. Admin dashboard: verification queue, all listings, all users, unlock requests.

## Out of scope
Real payments/escrow, real KYC or bank-verified funds (attestation only), e-signature (NDA is a
checkbox), outbound email (logged to console), scraping/sourcing, AI features.

## Tech stack
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn-style UI components
- Prisma ORM with SQLite for local dev (schema written so swapping to Postgres is trivial)
- Auth.js (NextAuth v5) with email+password credentials
- File uploads on local disk under /uploads behind one storage module (`src/lib/storage.ts`)
- Zod for all form + API validation

## Data model
See `prisma/schema.prisma`. User, Listing, Financials, AddBack, Document, UnlockRequest, Message.

## Financial normalization engine
Implemented as a pure, unit-tested module (`src/lib/financials.ts`):
- SDE = net profit + owner salary + total add-backs (interest/taxes/D&A captured as add-back
  categories).
- EBITDA = net profit + interest + taxes + depreciation + amortization (excludes owner-comp / other
  discretionary add-backs).
- Asking multiple = askingPrice / SDE, and a second on EBITDA.
- Returns a structured object with every component itemized for a transparent, auditable schedule.
- Validates add-back categories against an enum; flags uncategorized add-backs and any add-back
  > 15% of revenue with a warning the admin sees during verification.
- Thoroughly unit-tested with realistic messy inputs (`src/lib/financials.test.ts`).
