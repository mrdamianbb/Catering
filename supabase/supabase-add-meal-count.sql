-- v8.2.3 — liczba posiłków per dieta klienta
alter table public.diets
add column if not exists meal_count integer not null default 4;

alter table public.diets
drop constraint if exists diets_meal_count_check;

alter table public.diets
add constraint diets_meal_count_check
check (meal_count in (3,4,5));
