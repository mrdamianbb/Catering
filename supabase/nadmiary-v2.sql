-- Nadmiary jako swobodne hasła, nie tylko pozycje z bazy składników.
-- Część receptur ma skład wyłącznie w opisie, więc lista musi obejmować
-- także to, czego nie ma w tabeli ingredients.
--
-- Uruchom w Supabase → SQL Editor. Zastępuje wcześniejsze nadmiary-skladnikow.sql.

create table if not exists public.surplus_terms (
  term       text primary key,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.surplus_terms enable row level security;

drop policy if exists "kitchen admin read surplus" on public.surplus_terms;
create policy "kitchen admin read surplus"
on public.surplus_terms for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','kitchen')));

drop policy if exists "kitchen admin write surplus" on public.surplus_terms;
create policy "kitchen admin write surplus"
on public.surplus_terms for all to authenticated
using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','kitchen')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','kitchen')));

-- Przeniesienie wcześniejszych oznaczeń, jeśli były
insert into public.surplus_terms (term)
select lower(name) from public.ingredients
where coalesce(surplus,false) = true
on conflict (term) do nothing;
