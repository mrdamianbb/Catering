-- Shake jako dodatek do zamówienia ze strony.
-- Uruchom w Supabase → SQL Editor.

alter table public.store_orders add column if not exists shake_qty     integer not null default 0;
alter table public.store_orders add column if not exists shake_flavour text;

-- Kontrola: zamówienia z shakami
select customer_name, diet_name, days, shake_qty, shake_flavour, created_at
from public.store_orders
where coalesce(shake_qty,0) > 0
order by created_at desc;
