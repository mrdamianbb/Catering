-- Ceny dla nowych kaloryczności: 1400, 1500, 2100 i 2200 kcal.
-- Uruchom w Supabase → SQL Editor, w projekcie z dietami.
-- Można uruchamiać wielokrotnie — istniejące ceny zostaną nietknięte.

insert into public.diet_prices (kcal, price)
values (1400, 73), (1500, 76), (2100, 91), (2200, 93)
on conflict (kcal) do nothing;

select kcal, price from public.diet_prices order by kcal;
