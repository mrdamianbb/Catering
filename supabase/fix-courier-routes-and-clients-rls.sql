-- Poprawki bezpieczeństwa i obsługi tras wielokrotnych.
-- Uruchom w Supabase → SQL Editor. Można uruchamiać wielokrotnie.

-- ─────────────────────────────────────────────────────────────
-- 1. Kurier z kilkoma trasami (naprawa „Trasa A+B")
--    Stara polityka porównywała tylko profiles.route_code, więc kurier
--    przypisany do A i B widział wyłącznie A — pozycje z drugiej trasy
--    znikały bez żadnego komunikatu.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "courier reads issued active route" on public.diets;

create policy "courier reads issued active route"
on public.diets for select
to authenticated
using (
  kitchen_status = 'issued'
  and (current_date at time zone 'Europe/Warsaw')::date between start_date and end_date
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'courier'
      and upper(public.diets.route_code) = any (
        select upper(x)
        from unnest(
          coalesce(
            nullif(p.route_codes, '{}'),
            case when p.route_code is null then '{}'::text[] else array[p.route_code] end
          )
        ) as x
      )
  )
);

-- ─────────────────────────────────────────────────────────────
-- 2. Dane klientów — do tej pory bez zabezpieczenia na poziomie wierszy.
--    Bez tego każdy zalogowany użytkownik mógł pobrać z przeglądarki
--    pełną bazę: nazwiska, telefony i adresy.
-- ─────────────────────────────────────────────────────────────

alter table public.clients enable row level security;

drop policy if exists "admin kitchen read clients" on public.clients;
create policy "admin kitchen read clients"
on public.clients for select
to authenticated
using (
  exists (select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin','kitchen'))
);

-- Kurier widzi wyłącznie klientów, do których faktycznie dziś jedzie.
drop policy if exists "courier reads today clients" on public.clients;
create policy "courier reads today clients"
on public.clients for select
to authenticated
using (
  exists (
    select 1
    from public.diets d
    join public.profiles p on p.id = auth.uid()
    where d.client_id = public.clients.id
      and p.role = 'courier'
      and d.kitchen_status = 'issued'
      and (current_date at time zone 'Europe/Warsaw')::date between d.start_date and d.end_date
      and upper(d.route_code) = any (
        select upper(x)
        from unnest(
          coalesce(
            nullif(p.route_codes, '{}'),
            case when p.route_code is null then '{}'::text[] else array[p.route_code] end
          )
        ) as x
      )
  )
);

drop policy if exists "admin writes clients" on public.clients;
create policy "admin writes clients"
on public.clients for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- 3. Kontrola po wdrożeniu
-- ─────────────────────────────────────────────────────────────
-- Zaloguj się jako kurier z trasami A i B i sprawdź, czy liczba pozycji
-- przy wyborze „A+B" równa się sumie z „A" i „B" osobno.
