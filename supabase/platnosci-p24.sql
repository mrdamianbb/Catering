-- Płatności online Przelewy24.
-- Kwotę wylicza serwer i zapisuje w groszach; status zmienia wyłącznie
-- potwierdzenie z Przelewy24, nigdy przeglądarka klienta.

alter table public.store_orders add column if not exists payment_amount   integer;
alter table public.store_orders add column if not exists payment_session  text;
alter table public.store_orders add column if not exists payment_status   text default 'offline';
alter table public.store_orders add column if not exists payment_order_id bigint;
alter table public.store_orders add column if not exists payment_error    text;
alter table public.store_orders add column if not exists paid_at          timestamptz;

-- Jedna sesja płatności = jedno zamówienie
create unique index if not exists store_orders_payment_session_idx
  on public.store_orders (payment_session) where payment_session is not null;

-- Podgląd: co zapłacone, co czeka
select created_at, customer_name, diet_name, kcal, days,
       round(payment_amount/100.0, 2) as kwota_zl, payment_status, paid_at
from public.store_orders
order by created_at desc
limit 30;
