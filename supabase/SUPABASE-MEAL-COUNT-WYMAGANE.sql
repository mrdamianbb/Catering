-- Uruchom raz w Supabase SQL Editor.
alter table public.diets
add column if not exists meal_count integer not null default 4;

alter table public.diets
drop constraint if exists diets_meal_count_check;

alter table public.diets
add constraint diets_meal_count_check check (meal_count in (3,4,5));

-- Jeśli aplikacja korzysta z PostgREST, przeładuj cache schematu.
notify pgrst, 'reload schema';

-- Kontrola:
select id, client_name, diet_name, kcal, meal_count
from public.diets
order by id desc
limit 20;
