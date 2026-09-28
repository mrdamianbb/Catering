-- Uzupełnienie bazy, żeby dania nie powtarzały się z tygodnia na tydzień.
-- Symulacja sześciu tygodni: przy 15 śniadaniach i 12 podwieczorkach
-- (plus shake'i) żadne danie nie wraca w kolejnym tygodniu.
-- Dopisuje 4 śniadania i 6 podwieczorków — z zapasem.
--
-- Uruchom w Supabase → SQL Editor. Można uruchamiać wielokrotnie.

begin;

create temp table tmp_r(name text, meal_type text, base_kcal int,
  protein numeric, fat numeric, carbs numeric, food_cost numeric, notes text) on commit drop;

insert into tmp_r values
-- ŚNIADANIA
('Placuszki bananowe z jogurtem i borówkami','breakfast',410,22,12,54,6.50,'platki owsiane, banan, jajka, jogurt naturalny, borowki'),
('Kanapki z pastą z tuńczyka i ogórkiem','breakfast',400,28,14,40,7.50,'pieczywo zytnie, tunczyk, jogurt naturalny, ogorek, szczypiorek'),
('Kasza jaglana z jabłkiem i cynamonem','breakfast',390,11,9,66,4.50,'kasza jaglana, napoj ryzowy, jablko, cynamon, pestki dyni'),
('Pasta z awokado i jajkiem na pieczywie','breakfast',420,17,24,34,7.00,'pieczywo zytnie, awokado, jajka, pomidor, rzodkiewka'),
-- PODWIECZORKI
('Jogurt z musem malinowym i orzechami','snack',210,11,9,20,3.80,'jogurt naturalny, maliny, orzechy wloskie'),
('Batonik owsiany z daktylami','snack',200,5,7,30,2.60,'platki owsiane, daktyle, pestki slonecznika, kakao'),
('Hummus z paluszkami warzywnymi','snack',190,7,9,20,2.80,'ciecierzyca, tahini, marchew, ogorek, papryka'),
('Twarożek z rzodkiewką i szczypiorkiem','snack',185,18,8,8,3.20,'twarog poltlusty, rzodkiewka, szczypiorek'),
('Pieczona gruszka z cynamonem','snack',170,2,4,34,2.40,'gruszka, cynamon, miod, orzechy wloskie'),
('Chrupiące ciecierzyce z papryką','snack',195,9,6,26,2.20,'ciecierzyca, oliwa z oliwek, papryka wedzona');

create temp table tmp_i(recipe_name text, ingredient_name text, grams numeric) on commit drop;
insert into tmp_i values
('Placuszki bananowe z jogurtem i borówkami','płatki owsiane',50),('Placuszki bananowe z jogurtem i borówkami','banan',100),('Placuszki bananowe z jogurtem i borówkami','jajka',55),('Placuszki bananowe z jogurtem i borówkami','jogurt naturalny',100),('Placuszki bananowe z jogurtem i borówkami','borówki',60),
('Kanapki z pastą z tuńczyka i ogórkiem','pieczywo żytnie',80),('Kanapki z pastą z tuńczyka i ogórkiem','tuńczyk',80),('Kanapki z pastą z tuńczyka i ogórkiem','jogurt naturalny',40),('Kanapki z pastą z tuńczyka i ogórkiem','ogórek',70),
('Kasza jaglana z jabłkiem i cynamonem','kasza jaglana',70),('Kasza jaglana z jabłkiem i cynamonem','napój ryżowy',200),('Kasza jaglana z jabłkiem i cynamonem','jabłko',120),('Kasza jaglana z jabłkiem i cynamonem','pestki dyni',15),
('Pasta z awokado i jajkiem na pieczywie','pieczywo żytnie',70),('Pasta z awokado i jajkiem na pieczywie','awokado',70),('Pasta z awokado i jajkiem na pieczywie','jajka',55),('Pasta z awokado i jajkiem na pieczywie','pomidor',80),
('Jogurt z musem malinowym i orzechami','jogurt naturalny',150),('Jogurt z musem malinowym i orzechami','maliny',70),('Jogurt z musem malinowym i orzechami','orzechy włoskie',12),
('Batonik owsiany z daktylami','płatki owsiane',30),('Batonik owsiany z daktylami','daktyle',25),('Batonik owsiany z daktylami','pestki słonecznika',10),
('Hummus z paluszkami warzywnymi','ciecierzyca',80),('Hummus z paluszkami warzywnymi','tahini',10),('Hummus z paluszkami warzywnymi','marchew',80),('Hummus z paluszkami warzywnymi','ogórek',60),
('Twarożek z rzodkiewką i szczypiorkiem','twaróg półtłusty',130),('Twarożek z rzodkiewką i szczypiorkiem','rzodkiewka',60),('Twarożek z rzodkiewką i szczypiorkiem','szczypiorek',5),
('Pieczona gruszka z cynamonem','gruszka',200),('Pieczona gruszka z cynamonem','miód',8),('Pieczona gruszka z cynamonem','orzechy włoskie',8),
('Chrupiące ciecierzyce z papryką','ciecierzyca',90),('Chrupiące ciecierzyce z papryką','oliwa z oliwek',6);

insert into public.ingredients (name, unit)
select distinct t.ingredient_name, 'g' from tmp_i t
where not exists (select 1 from public.ingredients i where lower(i.name) = lower(t.ingredient_name));

insert into public.recipes (name, meal_type, diet_type, base_kcal, protein, fat, carbs, food_cost, active, notes)
select r.name, r.meal_type, 'Standard', r.base_kcal, r.protein, r.fat, r.carbs, r.food_cost, true, r.notes
from tmp_r r
where not exists (select 1 from public.recipes x where x.name = r.name and x.diet_type = 'Standard');

insert into public.recipe_ingredients (recipe_id, ingredient_id, grams)
select rc.id, ig.id, t.grams
from tmp_i t
join public.recipes rc on rc.name = t.recipe_name and rc.diet_type = 'Standard'
join public.ingredients ig on lower(ig.name) = lower(t.ingredient_name)
where not exists (select 1 from public.recipe_ingredients ri where ri.recipe_id = rc.id and ri.ingredient_id = ig.id);

commit;

-- Kontrola: ile dań na slot (cel: śniadania ≥ 15, podwieczorki + shake ≥ 16)
select meal_type, count(*) from public.recipes
where active = true and diet_type = 'Standard'
group by meal_type order by meal_type;
