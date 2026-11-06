# Project: Electronics shop management app

Web app for managing a single electronics equipment shop (stock, point of sale, customers, suppliers, reports). Used on desktop and tablet. Full requirements are in `SPEC.md` — read it before starting any feature.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS (+ shadcn/ui components)
- Supabase: PostgreSQL, Auth, Row Level Security
- Supabase clients: `@supabase/supabase-js` and `@supabase/ssr`
- Database schema lives in `supabase/schema.sql` (apply changes as new migration files, never edit applied history)

## Language rules
- **UI text is in French.**
- **All code comments, variable names, commit messages and docs inside code are in English.**

## Working rules
- Work on ONE feature at a time, following the stages in `SPEC.md`.
- For any non-trivial task: propose a short plan first and wait for approval before writing code.
- After each completed feature: run lint, type-check and tests, then summarize what changed.
- Never commit secrets. Environment variables go in `.env.local` (git-ignored).
- Never use the Supabase `service_role` key in browser code. Server-only code may use it, and only if truly needed.

## Data rules
- Money is stored as integers in the smallest currency unit. Never use floats for money.
- Stock is derived from `stock_movements`. Never update a stock number directly.
- Sales keep `unit_price` and `unit_cost` at the time of sale.
- Every table has Row Level Security enabled. New tables need policies in the same change.
- Roles: `owner`, `manager`, `seller`. Sellers must not see purchase prices or margins.

## Code style
- TypeScript strict mode, no `any` unless justified in a comment.
- Server Components by default; Client Components only for interactivity.
- Validate all form input (e.g. with zod) on the server, not only in the browser.
- Touch-friendly UI: buttons at least 44px high, readable on tablet.

## Commands
- `npm run dev` — start the dev server
- `npm run lint` — lint
- `npm run build` — production build check
- `npm test` — run tests (add Vitest when the first business logic is written)
