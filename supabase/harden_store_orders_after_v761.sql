-- APPLY ONLY AFTER v7.6.1 /api/order is deployed and a test order succeeds.
alter table public.store_orders enable row level security;
drop policy if exists "public can create store orders" on public.store_orders;
revoke insert, update, delete on table public.store_orders from anon;
-- The public storefront no longer needs direct writes. Backend uses secret/service role.
