-- URUCHOM RAZ W Supabase SQL Editor
alter table public.diets
add column if not exists meal_count integer not null default 4;

update public.diets
set meal_count = 4
where meal_count is null or meal_count not in (3,4,5);

alter table public.diets
drop constraint if exists diets_meal_count_check;

alter table public.diets
add constraint diets_meal_count_check check (meal_count in (3,4,5));

notify pgrst, 'reload schema';
