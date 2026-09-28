-- Nadmiary w magazynie: kuchnia zaznacza, czego ma dużo,
-- a układanie tygodnia preferuje receptury z tymi składnikami.
-- Uruchom w Supabase → SQL Editor.

alter table public.ingredients add column if not exists surplus       boolean     not null default false;
alter table public.ingredients add column if not exists surplus_note  text;
alter table public.ingredients add column if not exists surplus_at    timestamptz;

create index if not exists ingredients_surplus_idx on public.ingredients (surplus) where surplus;

alter table public.ingredients enable row level security;

drop policy if exists "kitchen admin read ingredients" on public.ingredients;
create policy "kitchen admin read ingredients"
on public.ingredients for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','kitchen')));

-- Kuchnia może oznaczać nadmiary. Ceny i nazwy zmienia tylko administrator
-- (pilnuje tego wyzwalacz poniżej).
drop policy if exists "kitchen admin update ingredients" on public.ingredients;
create policy "kitchen admin update ingredients"
on public.ingredients for update
to authenticated
using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','kitchen')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','kitchen')));

drop policy if exists "admin writes ingredients" on public.ingredients;
create policy "admin writes ingredients"
on public.ingredients for insert
to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.ingredients_kitchen_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.app_role;
begin
  select p.role into r from public.profiles p where p.id = auth.uid();
  if r = 'kitchen' then
    if new.name is distinct from old.name
       or new.unit is distinct from old.unit
       or new.price_per_kg is distinct from old.price_per_kg then
      raise exception 'Kuchnia może zmieniać wyłącznie oznaczenie nadmiaru.';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists ingredients_kitchen_guard on public.ingredients;
create trigger ingredients_kitchen_guard
before update on public.ingredients
for each row execute procedure public.ingredients_kitchen_guard();
