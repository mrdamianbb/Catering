-- Receptury uzupełniające luki wykryte audytem bazy.
-- Celują w cztery miejsca: śniadania bez jaj (Low Carb i Keto),
-- drugie posiłki bez nabiału (Low Carb i Standard) oraz kolacje
-- bez nabiału (Low Carb).
--
-- Wszystkie są jednocześnie BEZ JAJ i BEZ NABIAŁU — dzięki temu
-- jedna pozycja łata obie luki naraz.
--
-- Uruchom w Supabase → SQL Editor. Można uruchamiać wielokrotnie.

begin;

create temp table tmp_r(
  name text, meal_type text, diet_type text, base_kcal int,
  protein numeric, fat numeric, carbs numeric, food_cost numeric, notes text
) on commit drop;

insert into tmp_r values
-- KETO · ŚNIADANIA bez jaj i bez nabiału
('Awokado z łososiem wędzonym i kaparami','breakfast','Keto',555,29,46,5,16.50,'awokado, łosoś wędzony, oliwa z oliwek, kapary, rukola'),
('Sałatka z tuńczykiem, awokado i oliwkami','breakfast','Keto',545,32,43,5,13.00,'tuńczyk, awokado, oliwki, oliwa z oliwek, rukola'),
('Tofucznica keto z awokado i papryką','breakfast','Keto',540,28,44,7,11.00,'tofu, awokado, oliwa z oliwek, papryka, kurkuma'),
('Pasta z makreli z ogórkiem','breakfast','Keto',560,30,47,4,12.50,'makrela wędzona, awokado, oliwa z oliwek, ogórek, szczypiorek'),

-- LOW CARB · ŚNIADANIA bez jaj i bez nabiału
('Pasta z awokado i tuńczyka z warzywami','breakfast','Low Carb',405,31,26,9,11.00,'tuńczyk, awokado, ogórek, pomidor, oliwa z oliwek'),
('Sałatka z grillowanym kurczakiem i pomidorem','breakfast','Low Carb',395,34,23,10,10.50,'pierś z kurczaka, pomidor, ogórek, rukola, oliwa z oliwek'),
('Tofucznica z warzywami','breakfast','Low Carb',390,27,24,12,9.00,'tofu, papryka, cebula, szpinak, oliwa z oliwek'),
('Pasta z ciecierzycy z papryką','breakfast','Low Carb',400,22,23,20,8.00,'ciecierzyca, papryka, oliwa z oliwek, czosnek, natka pietruszki'),
('Sałatka z wędzoną makrelą i rzodkiewką','breakfast','Low Carb',410,30,27,8,11.50,'makrela wędzona, rzodkiewka, ogórek, sałata, oliwa z oliwek'),

-- DRUGIE POSIŁKI bez nabiału (dla Low Carb i Standard)
('Pudding chia na napoju kokosowym z malinami','second_breakfast','Low Carb',315,12,20,16,7.50,'nasiona chia, napój kokosowy, maliny, cynamon'),
('Guacamole z warzywami do maczania','second_breakfast','Low Carb',310,8,25,12,7.00,'awokado, pomidor, cebula, limonka, marchew, papryka'),
('Hummus z marchewką i papryką','second_breakfast','Low Carb',320,13,19,22,6.50,'ciecierzyca, tahini, oliwa z oliwek, marchew, papryka'),
('Koktajl bananowo-szpinakowy na napoju ryżowym','second_breakfast','Low Carb',305,9,12,36,6.00,'banan, szpinak, napój ryżowy, siemię lniane'),
('Sałatka owocowa z pestkami dyni','second_breakfast','Low Carb',300,8,15,30,6.50,'jabłko, gruszka, borówki, pestki dyni, cynamon'),

('Pudding chia na napoju kokosowym z malinami','second_breakfast','Standard',315,12,20,16,7.50,'nasiona chia, napój kokosowy, maliny, cynamon'),
('Guacamole z warzywami do maczania','second_breakfast','Standard',310,8,25,12,7.00,'awokado, pomidor, cebula, limonka, marchew, papryka'),
('Hummus z marchewką i papryką','second_breakfast','Standard',320,13,19,22,6.50,'ciecierzyca, tahini, oliwa z oliwek, marchew, papryka'),
('Koktajl bananowo-szpinakowy na napoju ryżowym','second_breakfast','Standard',305,9,12,36,6.00,'banan, szpinak, napój ryżowy, siemię lniane'),
('Sałatka owocowa z pestkami dyni','second_breakfast','Standard',300,8,15,30,6.50,'jabłko, gruszka, borówki, pestki dyni, cynamon'),

-- LOW CARB · KOLACJE bez nabiału
('Sałatka z kurczakiem i awokado','dinner','Low Carb',385,32,24,8,11.00,'pierś z kurczaka, awokado, rukola, pomidor, oliwa z oliwek'),
('Krem z dyni z pestkami','dinner','Low Carb',360,12,24,22,7.00,'dynia, marchew, cebula, oliwa z oliwek, pestki dyni'),
('Stir-fry z indykiem i warzywami','dinner','Low Carb',395,35,21,12,10.50,'pierś z indyka, brokuł, papryka, marchew, oliwa z oliwek'),
('Sałatka z tuńczykiem i fasolką szparagową','dinner','Low Carb',380,33,22,11,10.00,'tuńczyk, fasolka szparagowa, pomidor, cebula, oliwa z oliwek');

create temp table tmp_i(recipe_name text, ingredient_name text, grams numeric) on commit drop;

insert into tmp_i values
('Awokado z łososiem wędzonym i kaparami','awokado',120),('Awokado z łososiem wędzonym i kaparami','łosoś wędzony',90),('Awokado z łososiem wędzonym i kaparami','oliwa z oliwek',20),('Awokado z łososiem wędzonym i kaparami','kapary',10),('Awokado z łososiem wędzonym i kaparami','rukola',30),
('Sałatka z tuńczykiem, awokado i oliwkami','tuńczyk',120),('Sałatka z tuńczykiem, awokado i oliwkami','awokado',100),('Sałatka z tuńczykiem, awokado i oliwkami','oliwki',40),('Sałatka z tuńczykiem, awokado i oliwkami','oliwa z oliwek',25),('Sałatka z tuńczykiem, awokado i oliwkami','rukola',30),
('Tofucznica keto z awokado i papryką','tofu',150),('Tofucznica keto z awokado i papryką','awokado',80),('Tofucznica keto z awokado i papryką','oliwa z oliwek',25),('Tofucznica keto z awokado i papryką','papryka',50),
('Pasta z makreli z ogórkiem','makrela wędzona',120),('Pasta z makreli z ogórkiem','awokado',80),('Pasta z makreli z ogórkiem','oliwa z oliwek',15),('Pasta z makreli z ogórkiem','ogórek',80),('Pasta z makreli z ogórkiem','szczypiorek',5),

('Pasta z awokado i tuńczyka z warzywami','tuńczyk',110),('Pasta z awokado i tuńczyka z warzywami','awokado',80),('Pasta z awokado i tuńczyka z warzywami','ogórek',70),('Pasta z awokado i tuńczyka z warzywami','pomidor',70),('Pasta z awokado i tuńczyka z warzywami','oliwa z oliwek',10),
('Sałatka z grillowanym kurczakiem i pomidorem','pierś z kurczaka',130),('Sałatka z grillowanym kurczakiem i pomidorem','pomidor',90),('Sałatka z grillowanym kurczakiem i pomidorem','ogórek',70),('Sałatka z grillowanym kurczakiem i pomidorem','rukola',30),('Sałatka z grillowanym kurczakiem i pomidorem','oliwa z oliwek',15),
('Tofucznica z warzywami','tofu',160),('Tofucznica z warzywami','papryka',70),('Tofucznica z warzywami','cebula',30),('Tofucznica z warzywami','szpinak',60),('Tofucznica z warzywami','oliwa z oliwek',15),
('Pasta z ciecierzycy z papryką','ciecierzyca',130),('Pasta z ciecierzycy z papryką','papryka',80),('Pasta z ciecierzycy z papryką','oliwa z oliwek',15),('Pasta z ciecierzycy z papryką','czosnek',5),('Pasta z ciecierzycy z papryką','natka pietruszki',5),
('Sałatka z wędzoną makrelą i rzodkiewką','makrela wędzona',110),('Sałatka z wędzoną makrelą i rzodkiewką','rzodkiewka',60),('Sałatka z wędzoną makrelą i rzodkiewką','ogórek',70),('Sałatka z wędzoną makrelą i rzodkiewką','sałata',40),('Sałatka z wędzoną makrelą i rzodkiewką','oliwa z oliwek',15),

('Pudding chia na napoju kokosowym z malinami','nasiona chia',30),('Pudding chia na napoju kokosowym z malinami','napój kokosowy',180),('Pudding chia na napoju kokosowym z malinami','maliny',80),
('Guacamole z warzywami do maczania','awokado',130),('Guacamole z warzywami do maczania','pomidor',60),('Guacamole z warzywami do maczania','cebula',20),('Guacamole z warzywami do maczania','marchew',80),('Guacamole z warzywami do maczania','papryka',80),
('Hummus z marchewką i papryką','ciecierzyca',110),('Hummus z marchewką i papryką','tahini',20),('Hummus z marchewką i papryką','oliwa z oliwek',15),('Hummus z marchewką i papryką','marchew',90),('Hummus z marchewką i papryką','papryka',80),
('Koktajl bananowo-szpinakowy na napoju ryżowym','banan',120),('Koktajl bananowo-szpinakowy na napoju ryżowym','szpinak',50),('Koktajl bananowo-szpinakowy na napoju ryżowym','napój ryżowy',200),('Koktajl bananowo-szpinakowy na napoju ryżowym','siemię lniane',15),
('Sałatka owocowa z pestkami dyni','jabłko',120),('Sałatka owocowa z pestkami dyni','gruszka',100),('Sałatka owocowa z pestkami dyni','borówki',60),('Sałatka owocowa z pestkami dyni','pestki dyni',25),

('Sałatka z kurczakiem i awokado','pierś z kurczaka',130),('Sałatka z kurczakiem i awokado','awokado',80),('Sałatka z kurczakiem i awokado','rukola',35),('Sałatka z kurczakiem i awokado','pomidor',80),('Sałatka z kurczakiem i awokado','oliwa z oliwek',15),
('Krem z dyni z pestkami','dynia',250),('Krem z dyni z pestkami','marchew',80),('Krem z dyni z pestkami','cebula',30),('Krem z dyni z pestkami','oliwa z oliwek',20),('Krem z dyni z pestkami','pestki dyni',20),
('Stir-fry z indykiem i warzywami','pierś z indyka',140),('Stir-fry z indykiem i warzywami','brokuł',120),('Stir-fry z indykiem i warzywami','papryka',80),('Stir-fry z indykiem i warzywami','marchew',60),('Stir-fry z indykiem i warzywami','oliwa z oliwek',15),
('Sałatka z tuńczykiem i fasolką szparagową','tuńczyk',130),('Sałatka z tuńczykiem i fasolką szparagową','fasolka szparagowa',120),('Sałatka z tuńczykiem i fasolką szparagową','pomidor',70),('Sałatka z tuńczykiem i fasolką szparagową','cebula',20),('Sałatka z tuńczykiem i fasolką szparagową','oliwa z oliwek',15);

insert into public.ingredients (name, unit)
select distinct t.ingredient_name, 'g'
from tmp_i t
where not exists (select 1 from public.ingredients i where lower(i.name) = lower(t.ingredient_name));

insert into public.recipes (name, meal_type, diet_type, base_kcal, protein, fat, carbs, food_cost, active, notes)
select r.name, r.meal_type, r.diet_type, r.base_kcal, r.protein, r.fat, r.carbs, r.food_cost, true, r.notes
from tmp_r r
where not exists (
  select 1 from public.recipes x where x.name = r.name and x.diet_type = r.diet_type
);

insert into public.recipe_ingredients (recipe_id, ingredient_id, grams)
select rc.id, ig.id, t.grams
from tmp_i t
join public.recipes rc on rc.name = t.recipe_name
join public.ingredients ig on lower(ig.name) = lower(t.ingredient_name)
where rc.id in (select id from public.recipes where name in (select name from tmp_r))
  and not exists (
    select 1 from public.recipe_ingredients ri
    where ri.recipe_id = rc.id and ri.ingredient_id = ig.id
  );

commit;
