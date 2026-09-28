-- Receptury bez powiązanych składników.
-- Takie dania mają skład tylko w opisie, więc na naklejce pojawi się
-- lista bez gramatur, a kuchnia nie dostanie wag do odważenia.

-- 1. Skala problemu
select
  count(*) filter (where powiazan = 0) as bez_gramatur,
  count(*) filter (where powiazan > 0) as z_gramaturami,
  count(*)                              as wszystkie
from (
  select r.id, count(ri.id) as powiazan
  from public.recipes r
  left join public.recipe_ingredients ri on ri.recipe_id = r.id
  where r.active = true
  group by r.id
) t;

-- 2. Które dokładnie, z podziałem na dietę i posiłek
select r.diet_type, r.meal_type, r.name, coalesce(r.notes,'—') as sklad_z_opisu
from public.recipes r
left join public.recipe_ingredients ri on ri.recipe_id = r.id
where r.active = true
group by r.id, r.diet_type, r.meal_type, r.name, r.notes
having count(ri.id) = 0
order by r.diet_type, r.meal_type, r.name;

-- 3. Czy te receptury w ogóle wchodzą do menu (czy problem jest pilny)
select r.name, count(wm.id) as razy_w_menu
from public.recipes r
left join public.recipe_ingredients ri on ri.recipe_id = r.id
left join public.weekly_menu wm on wm.recipe_id = r.id and wm.menu_date >= current_date - 14
where r.active = true
group by r.id, r.name
having count(ri.id) = 0 and count(wm.id) > 0
order by count(wm.id) desc;
