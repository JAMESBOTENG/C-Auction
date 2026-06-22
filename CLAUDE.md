# CLAUDE.md — conventions & orientation

## What this is
Succession — a verified-financials marketplace for SMB acquisitions. See `SPEC.md` for the full
product spec and `README.md` for setup/run instructions.

## How to run
```bash
npm install
npx prisma migrate dev   # creates SQLite db + applies migrations
npm run seed             # seeds users + 7 verified listings
npm run dev              # http://localhost:3000
npm test                 # vitest — financial engine unit tests
npm run build            # production build / typecheck
```

## The financial engine (the moat) — `src/lib/financials.ts`
This is the most important code in the repo. It is **pure** (no IO, no framework imports) and
**fully unit-tested** in `src/lib/financials.test.ts`. Any change to SDE/EBITDA math, add-back
categories, or warning rules must keep the tests green and add new ones.

- `normalizeYear(input)` → itemized one-year derivation (net profit, SDE, EBITDA, warnings).
- `normalizeListing(years, askingPrice)` → sorts years, picks latest, computes both multiples.
- `src/lib/listing-data.ts` loads a listing's rows from the DB and runs them through the engine.
  Server pages/components call `getNormalizedFinancials(listingId)`.

## Project layout
- `src/app/` — App Router pages.
  - `/login` — credentials sign-in + register (server actions in `actions.ts`).
  - `/listings` and `/listings/[id]` — buyer browse/filter + gated detail + deal room.
  - `/seller`, `/seller/new`, `/seller/[id]` — dashboard, wizard, manage/upload/submit.
  - `/admin` — verification queue, listings, users, unlock requests.
  - `/uploads/[...path]` — authenticated file serving for the local-disk storage.
  - `/api/auth/[...nextauth]` — Auth.js handlers.
- `src/lib/` — `prisma.ts`, `auth.ts`, `access.ts` (gating), `storage.ts`, `utils.ts`, `financials.ts`.
- `src/components/` — UI primitives in `ui/`, plus `financial-schedule`, `listing-wizard`,
  `unlock-form`, `deal-room`, `site-nav`, `verified-badge`, `status-badge`.
- `prisma/` — `schema.prisma`, `seed.ts`, migrations.

## Conventions
- All form + API input is validated with **Zod** (in server actions / route handlers).
- Mutations are **server actions** (`"use server"`). They re-check auth/role and `revalidatePath`.
- **Gating** is centralized in `src/lib/access.ts` (`getListingAccess`). Admins and owning sellers
  always see gated content; buyers need an `APPROVED` `UnlockRequest`.
- SQLite has no JSON type: `Financials.operatingExpenses` is stored as a JSON **string** and
  (de)serialized via `parseJson` in `src/lib/utils.ts`. Same code works on Postgres later.
- Storage is abstracted behind `src/lib/storage.ts` — swap that one module for S3/Supabase.
- Outbound email is out of scope — notification points just `console.log("[email] …")`.

## Swapping to Postgres later
Change `datasource db { provider = "postgresql" }` and `DATABASE_URL`, then
`npx prisma migrate dev`. The JSON-as-string column keeps working; no app code changes required.
