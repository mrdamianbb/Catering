-- Przypomnienia o kończącej się diecie.
-- Tabela pilnuje, żeby ten sam klient nie dostał dwóch SMS-ów o tej samej diecie.
-- Uruchom w Supabase → SQL Editor.

create table if not exists public.diet_reminders (
  id         bigserial primary key,
  diet_id    bigint      not null,
  kind       text        not null default 'koniec',
  sent_at    timestamptz not null default now(),
  sms_status text,
  constraint diet_reminders_once unique (diet_id, kind)
);

create index if not exists diet_reminders_sent_idx on public.diet_reminders (sent_at);

alter table public.diet_reminders enable row level security;

drop policy if exists "admin reads reminders" on public.diet_reminders;
create policy "admin reads reminders"
on public.diet_reminders for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','kitchen')));

-- Zgoda na kontakt marketingowy przy zamówieniu
alter table public.store_orders add column if not exists marketing_consent boolean not null default false;
alter table public.clients      add column if not exists marketing_consent boolean not null default false;
