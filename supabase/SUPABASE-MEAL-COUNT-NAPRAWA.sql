-- URUCHOM TEN PLIK RAZ W SUPABASE SQL EDITOR.
-- Zapewnia kolumnę 3/4/5 i przeładowuje PostgREST.

alter table public.diets
  add column if not exists meal_count integer;

update public.diets
set meal_count = 4
where meal_count is null or meal_count not in (3,4,5);

alter table public.diets
  alter column meal_count set default 4;

alter table public.diets
  alter column meal_count set not null;

alter table public.diets
  drop constraint if exists diets_meal_count_check;

alter table public.diets
  add constraint diets_meal_count_check check (meal_count in (3,4,5));

notify pgrst, 'reload schema';

-- TEST: ta tabela MUSI pokazać kolumnę meal_count.
select id, client_name, diet_name, kcal, meal_count
from public.diets
order by id desc
limit 30;
