-- Rejestr dostaw + ochrona przed wysłaniem dwóch SMS-ów za to samo.
-- Uruchom w Supabase → SQL Editor.

create table if not exists public.deliveries (
  id            bigserial primary key,
  diet_id       bigint      not null,
  client_id     bigint,
  delivery_date date        not null,
  delivered_at  timestamptz not null default now(),
  courier_id    uuid        not null,
  route_code    text,
  sms_status    text,                 -- sent | failed | no_phone | not_configured
  sms_error     text,
  constraint deliveries_once_per_day unique (diet_id, delivery_date)
);

create index if not exists deliveries_date_idx on public.deliveries (delivery_date);
create index if not exists deliveries_courier_idx on public.deliveries (courier_id, delivery_date);

alter table public.deliveries enable row level security;

-- Kurier widzi wyłącznie własne dostawy. Zapisu z przeglądarki nie ma —
-- wpis tworzy serwer kluczem serwisowym, po sprawdzeniu uprawnień.
drop policy if exists deliveries_select_own on public.deliveries;
create policy deliveries_select_own on public.deliveries
  for select using (
    courier_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
