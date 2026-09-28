# Security audit v7.6.1

Implemented:
- Turnstile verification server-side.
- 5 attempts / 10 minutes rate limiter.
- 16 KB order request limit and JSON-only endpoint.
- Same-origin request check.
- Honeypot.
- Shared client/server validation (`lib/orderValidation.ts`).
- Live field validation; days cannot remain -1 unnoticed.
- Local-date min date (no UTC off-by-one).
- Mobile diet list forced to flex-column and x-overflow removed.
- Security response headers + CSP.
- Next.js pinned to 15.5.21 Maintenance LTS instead of `latest`.
- Dependencies pinned rather than floating.

Database cutover still required after deployment:
- Remove `public can create store orders`.
- Revoke anon INSERT/UPDATE/DELETE on store_orders.
- Then audit grants/RLS for every public table using Supabase Security Advisor / SQL.

Important current advisory:
Next.js announced an August 26, 2026 security release with a critical fix.
Upgrade from 15.5.21 to the patched 15.5 release immediately when published and rebuild.


Build note: source changes were prepared, but dependency download/build verification could not complete in the isolated artifact environment. Vercel should run the production build after upload; do not cut over the database policy unless that deployment succeeds and a test order is accepted.
