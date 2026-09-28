-- Kuchnia musi czytać receptury i układać menu tygodniowe.
-- Objaw bez tego: „Brak receptury" w podglądzie, food cost 0,00 zł
-- i błąd 403 przy przycisku „Ułóż ten tydzień".
--
-- Uruchom w Supabase → SQL Editor, w projekcie z dietami.
-- Można uruchamiać wielokrotnie.

-- ── RECEPTURY ──────────────────────────────────────────────
alter table public.recipes enable row level security;

drop policy if exists "kitchen admin read recipes" on public.recipes;
create policy "kitchen admin read recipes"
on public.recipes for select
to authenticated
using (
  exists (select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin','kitchen'))
);

-- Dodawać i zmieniać receptury może wyłącznie administrator.
drop policy if exists "admin writes recipes" on public.recipes;
create policy "admin writes recipes"
on public.recipes for all
to authenticated
using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── MENU TYGODNIOWE ────────────────────────────────────────
alter table public.weekly_menu enable row level security;

drop policy if exists "kitchen admin read menu" on public.weekly_menu;
create policy "kitchen admin read menu"
on public.weekly_menu for select
to authenticated
using (
  exists (select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin','kitchen'))
);

-- Układanie tygodnia: kuchnia i administrator.
drop policy if exists "kitchen admin insert menu" on public.weekly_menu;
create policy "kitchen admin insert menu"
on public.weekly_menu for insert
to authenticated
with check (
  exists (select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin','kitchen'))
);

drop policy if exists "kitchen admin delete menu" on public.weekly_menu;
create policy "kitchen admin delete menu"
on public.weekly_menu for delete
to authenticated
using (
  exists (select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin','kitchen'))
);

drop policy if exists "kitchen admin update menu" on public.weekly_menu;
create policy "kitchen admin update menu"
on public.weekly_menu for update
to authenticated
using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','kitchen')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','kitchen')));

-- ── Kontrola ───────────────────────────────────────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('recipes','weekly_menu')
order by tablename, cmd;
