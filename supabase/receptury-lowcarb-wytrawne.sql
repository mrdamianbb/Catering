-- Wytrawne receptury Low Carb — bez słodkiego i bez zup.
-- Klient Low Carb z wykluczeniami „nie na słodko" i „bez zup" miał tylko
-- 5 drugich posiłków na 7 dni, a podwieczorki spadały na Standard, gdzie
-- prawie wszystko jest słodkie. Dopisujemy 4 drugie posiłki i 7 podwieczorków.
-- Część jest bez nabiału i bez jaj, żeby wystarczyło też przy innych wykluczeniach.
--
-- Uruchom w Supabase → SQL Editor. Można uruchamiać wielokrotnie.

begin;

create temp table tmp_r(name text, meal_type text, base_kcal int,
  protein numeric, fat numeric, carbs numeric, food_cost numeric, notes text) on commit drop;

insert into tmp_r values
-- DRUGIE POSIŁKI
('Jajka faszerowane pastą z awokado','second_breakfast',320,17,25,6,5.50,'jajka, awokado, szczypiorek, rzodkiewka'),
('Roladki z indyka z serkiem i ogórkiem','second_breakfast',310,26,19,6,7.00,'pieczen z indyka, serek smietankowy, ogorek, rukola'),
('Pasta z wędzonej makreli z warzywami','second_breakfast',330,22,24,7,6.50,'makrela wedzona, ogorek, papryka, szczypiorek'),
('Sałatka z tuńczykiem i fasolką szparagową','second_breakfast',300,26,17,9,6.00,'tunczyk, fasolka szparagowa, pomidor, oliwa z oliwek'),
-- PODWIECZORKI
('Pieczone warzywa z dipem czosnkowym','snack',190,8,12,12,3.80,'cukinia, papryka, jogurt grecki, czosnek'),
('Oliwki z fetą i pomidorami cherry','snack',210,8,17,6,4.50,'oliwki, feta, pomidory cherry'),
('Jajko z majonezem i szczypiorkiem','snack',195,9,17,1,2.40,'jajka, majonez, szczypiorek'),
('Chipsy z jarmużu z pestkami słonecznika','snack',185,7,14,8,3.20,'jarmuz, pestki slonecznika, oliwa z oliwek'),
('Serek wiejski z ogórkiem i koperkiem','snack',180,17,8,6,3.00,'serek wiejski, ogorek, koperek'),
('Pasta z sardynek z papryką','snack',200,16,13,5,3.60,'sardynki, papryka, cebula'),
('Tatar z łososia z ogórkiem','snack',190,15,13,3,6.50,'losos wedzony, ogorek, kapary, oliwa z oliwek');

create temp table tmp_i(recipe_name text, ingredient_name text, grams numeric) on commit drop;
insert into tmp_i values
('Jajka faszerowane pastą z awokado','jajka',110),('Jajka faszerowane pastą z awokado','awokado',70),('Jajka faszerowane pastą z awokado','rzodkiewka',50),('Jajka faszerowane pastą z awokado','szczypiorek',5),
('Roladki z indyka z serkiem i ogórkiem','pieczeń z indyka',90),('Roladki z indyka z serkiem i ogórkiem','serek śmietankowy',50),('Roladki z indyka z serkiem i ogórkiem','ogórek',70),('Roladki z indyka z serkiem i ogórkiem','rukola',20),
('Pasta z wędzonej makreli z warzywami','makrela wędzona',90),('Pasta z wędzonej makreli z warzywami','ogórek',70),('Pasta z wędzonej makreli z warzywami','papryka',70),('Pasta z wędzonej makreli z warzywami','szczypiorek',5),
('Sałatka z tuńczykiem i fasolką szparagową','tuńczyk',100),('Sałatka z tuńczykiem i fasolką szparagową','fasolka szparagowa',100),('Sałatka z tuńczykiem i fasolką szparagową','pomidor',70),('Sałatka z tuńczykiem i fasolką szparagową','oliwa z oliwek',10),
('Pieczone warzywa z dipem czosnkowym','cukinia',120),('Pieczone warzywa z dipem czosnkowym','papryka',90),('Pieczone warzywa z dipem czosnkowym','jogurt grecki',60),('Pieczone warzywa z dipem czosnkowym','czosnek',3),
('Oliwki z fetą i pomidorami cherry','oliwki',50),('Oliwki z fetą i pomidorami cherry','feta',45),('Oliwki z fetą i pomidorami cherry','pomidory cherry',90),
('Jajko z majonezem i szczypiorkiem','jajka',110),('Jajko z majonezem i szczypiorkiem','majonez',15),('Jajko z majonezem i szczypiorkiem','szczypiorek',5),
('Chipsy z jarmużu z pestkami słonecznika','jarmuż',60),('Chipsy z jarmużu z pestkami słonecznika','pestki słonecznika',15),('Chipsy z jarmużu z pestkami słonecznika','oliwa z oliwek',10),
('Serek wiejski z ogórkiem i koperkiem','serek wiejski',150),('Serek wiejski z ogórkiem i koperkiem','ogórek',80),('Serek wiejski z ogórkiem i koperkiem','koperek',5),
('Pasta z sardynek z papryką','sardynki',90),('Pasta z sardynek z papryką','papryka',70),('Pasta z sardynek z papryką','cebula',20),
('Tatar z łososia z ogórkiem','łosoś wędzony',80),('Tatar z łososia z ogórkiem','ogórek',70),('Tatar z łososia z ogórkiem','kapary',8),('Tatar z łososia z ogórkiem','oliwa z oliwek',8);

insert into public.ingredients (name, unit)
select distinct t.ingredient_name, 'g' from tmp_i t
where not exists (select 1 from public.ingredients i where lower(i.name) = lower(t.ingredient_name));

insert into public.recipes (name, meal_type, diet_type, base_kcal, protein, fat, carbs, food_cost, active, notes)
select r.name, r.meal_type, 'Low Carb', r.base_kcal, r.protein, r.fat, r.carbs, r.food_cost, true, r.notes
from tmp_r r
where not exists (select 1 from public.recipes x where x.name = r.name and x.diet_type = 'Low Carb');

insert into public.recipe_ingredients (recipe_id, ingredient_id, grams)
select rc.id, ig.id, t.grams
from tmp_i t
join public.recipes rc on rc.name = t.recipe_name and rc.diet_type = 'Low Carb'
join public.ingredients ig on lower(ig.name) = lower(t.ingredient_name)
where not exists (select 1 from public.recipe_ingredients ri where ri.recipe_id = rc.id and ri.ingredient_id = ig.id);

commit;

select meal_type, count(*) from public.recipes
where active = true and diet_type = 'Low Carb'
group by meal_type order by meal_type;
