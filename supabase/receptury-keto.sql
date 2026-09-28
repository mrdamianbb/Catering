-- Osiemnaście receptur keto: sześć śniadań, sześć obiadów, sześć kolacji.
-- Razem ze składnikami i gramaturami, żeby kuchnia od razu widziała wagi.
--
-- Uruchom w Supabase → SQL Editor, w projekcie z dietami.
-- Można uruchamiać wielokrotnie — istniejące pozycje nie zostaną zdublowane.
--
-- Gramatury podane na porcję bazową. System przelicza je automatycznie
-- przez współczynnik kaloryczności klienta.

begin;

create temp table tmp_recipes(
  name text, meal_type text, base_kcal int,
  protein numeric, fat numeric, carbs numeric, food_cost numeric, notes text
) on commit drop;

insert into tmp_recipes values
-- ŚNIADANIA (udział 30% dnia)
('Omlet z boczkiem i awokado',              'breakfast', 560, 28, 47,  6, 11.50, 'jajka, boczek, awokado, masło klarowane, szczypiorek'),
('Jajka sadzone z chorizo i szpinakiem',    'breakfast', 555, 30, 45,  5, 12.00, 'jajka, chorizo, szpinak, oliwa'),
('Szakszuka keto z fetą i oliwkami',        'breakfast', 540, 26, 43,  9, 10.50, 'jajka, pomidory, feta, oliwki, oliwa'),
('Twarożek keto z orzechami i awokado',     'breakfast', 545, 27, 44,  7, 11.00, 'twaróg tłusty, awokado, orzechy włoskie, oliwa'),
('Jajecznica z łososiem wędzonym',          'breakfast', 570, 32, 47,  3, 14.50, 'jajka, łosoś wędzony, masło, koperek'),
('Omlet z cheddarem i pieczarkami',         'breakfast', 550, 31, 44,  5, 11.00, 'jajka, ser cheddar, pieczarki, masło'),
-- OBIADY (udział 40% dnia)
('Kaczka konfitowana z puree z kalafiora',  'lunch', 760, 42, 60, 11, 19.00, 'kaczka, kalafior, masło, śmietana 30%'),
('Stek z antrykotu z masłem ziołowym',      'lunch', 770, 48, 61,  7, 22.00, 'antrykot wołowy, masło, brokuł, oliwa'),
('Łosoś pieczony ze szparagami',            'lunch', 745, 45, 58,  8, 21.00, 'łosoś, szparagi, masło, cytryna'),
('Udka z kurczaka z cukinią w śmietanie',   'lunch', 755, 44, 59,  9, 14.50, 'udka z kurczaka, cukinia, śmietana 30%, oliwa'),
('Karkówka duszona z pieczarkami',          'lunch', 765, 43, 61, 10, 15.50, 'karkówka, pieczarki, śmietana 30%, cebula'),
('Dorsz w sosie maślano-cytrynowym',        'lunch', 740, 46, 57,  8, 18.50, 'dorsz, brokuł, masło, cytryna'),
-- KOLACJE (udział 30% dnia)
('Sałatka z kurczakiem, awokado i fetą',    'dinner', 560, 34, 44,  7, 13.00, 'kurczak, awokado, feta, rukola, oliwa'),
('Krewetki na maśle czosnkowym z cukinią',  'dinner', 545, 31, 43,  6, 17.50, 'krewetki, cukinia, masło, czosnek'),
('Deska serów z orzechami i oliwkami',      'dinner', 570, 28, 49,  6, 15.00, 'ser camembert, ser żółty, orzechy włoskie, oliwki'),
('Sałatka z tuńczykiem, jajkiem i majonezem','dinner', 555, 35, 43,  4, 12.00, 'tuńczyk, jajka, majonez, sałata'),
('Roladki z szynki z serkiem i szpinakiem', 'dinner', 535, 30, 43,  5, 11.50, 'szynka, serek śmietankowy, szpinak, oliwa'),
('Zupa krem z brokułów z boczkiem',         'dinner', 550, 24, 46,  9, 10.00, 'brokuł, śmietana 30%, boczek, masło');

create temp table tmp_ing(recipe_name text, ingredient_name text, grams numeric) on commit drop;

insert into tmp_ing values
('Omlet z boczkiem i awokado','jajka',150),('Omlet z boczkiem i awokado','boczek',60),('Omlet z boczkiem i awokado','awokado',80),('Omlet z boczkiem i awokado','masło klarowane',10),('Omlet z boczkiem i awokado','szczypiorek',5),
('Jajka sadzone z chorizo i szpinakiem','jajka',150),('Jajka sadzone z chorizo i szpinakiem','chorizo',60),('Jajka sadzone z chorizo i szpinakiem','szpinak',80),('Jajka sadzone z chorizo i szpinakiem','oliwa z oliwek',15),
('Szakszuka keto z fetą i oliwkami','jajka',120),('Szakszuka keto z fetą i oliwkami','pomidory',120),('Szakszuka keto z fetą i oliwkami','feta',60),('Szakszuka keto z fetą i oliwkami','oliwki',30),('Szakszuka keto z fetą i oliwkami','oliwa z oliwek',15),
('Twarożek keto z orzechami i awokado','twaróg tłusty',150),('Twarożek keto z orzechami i awokado','awokado',70),('Twarożek keto z orzechami i awokado','orzechy włoskie',25),('Twarożek keto z orzechami i awokado','oliwa z oliwek',10),
('Jajecznica z łososiem wędzonym','jajka',150),('Jajecznica z łososiem wędzonym','łosoś wędzony',60),('Jajecznica z łososiem wędzonym','masło',20),('Jajecznica z łososiem wędzonym','koperek',5),
('Omlet z cheddarem i pieczarkami','jajka',150),('Omlet z cheddarem i pieczarkami','ser cheddar',50),('Omlet z cheddarem i pieczarkami','pieczarki',90),('Omlet z cheddarem i pieczarkami','masło',15),

('Kaczka konfitowana z puree z kalafiora','kaczka',180),('Kaczka konfitowana z puree z kalafiora','kalafior',200),('Kaczka konfitowana z puree z kalafiora','masło',30),('Kaczka konfitowana z puree z kalafiora','śmietana 30%',40),
('Stek z antrykotu z masłem ziołowym','antrykot wołowy',200),('Stek z antrykotu z masłem ziołowym','masło',30),('Stek z antrykotu z masłem ziołowym','brokuł',150),('Stek z antrykotu z masłem ziołowym','oliwa z oliwek',10),
('Łosoś pieczony ze szparagami','łosoś',200),('Łosoś pieczony ze szparagami','szparagi',150),('Łosoś pieczony ze szparagami','masło',25),('Łosoś pieczony ze szparagami','cytryna',10),
('Udka z kurczaka z cukinią w śmietanie','udka z kurczaka',200),('Udka z kurczaka z cukinią w śmietanie','cukinia',150),('Udka z kurczaka z cukinią w śmietanie','śmietana 30%',60),('Udka z kurczaka z cukinią w śmietanie','oliwa z oliwek',10),
('Karkówka duszona z pieczarkami','karkówka',180),('Karkówka duszona z pieczarkami','pieczarki',120),('Karkówka duszona z pieczarkami','śmietana 30%',60),('Karkówka duszona z pieczarkami','cebula',30),
('Dorsz w sosie maślano-cytrynowym','dorsz',200),('Dorsz w sosie maślano-cytrynowym','brokuł',160),('Dorsz w sosie maślano-cytrynowym','masło',35),('Dorsz w sosie maślano-cytrynowym','cytryna',10),

('Sałatka z kurczakiem, awokado i fetą','pierś z kurczaka',120),('Sałatka z kurczakiem, awokado i fetą','awokado',80),('Sałatka z kurczakiem, awokado i fetą','feta',50),('Sałatka z kurczakiem, awokado i fetą','rukola',40),('Sałatka z kurczakiem, awokado i fetą','oliwa z oliwek',20),
('Krewetki na maśle czosnkowym z cukinią','krewetki',150),('Krewetki na maśle czosnkowym z cukinią','cukinia',130),('Krewetki na maśle czosnkowym z cukinią','masło',30),('Krewetki na maśle czosnkowym z cukinią','czosnek',5),
('Deska serów z orzechami i oliwkami','ser camembert',80),('Deska serów z orzechami i oliwkami','ser żółty',50),('Deska serów z orzechami i oliwkami','orzechy włoskie',30),('Deska serów z orzechami i oliwkami','oliwki',40),
('Sałatka z tuńczykiem, jajkiem i majonezem','tuńczyk',120),('Sałatka z tuńczykiem, jajkiem i majonezem','jajka',100),('Sałatka z tuńczykiem, jajkiem i majonezem','majonez',40),('Sałatka z tuńczykiem, jajkiem i majonezem','sałata',50),
('Roladki z szynki z serkiem i szpinakiem','szynka',100),('Roladki z szynki z serkiem i szpinakiem','serek śmietankowy',80),('Roladki z szynki z serkiem i szpinakiem','szpinak',60),('Roladki z szynki z serkiem i szpinakiem','oliwa z oliwek',10),
('Zupa krem z brokułów z boczkiem','brokuł',200),('Zupa krem z brokułów z boczkiem','śmietana 30%',60),('Zupa krem z brokułów z boczkiem','boczek',50),('Zupa krem z brokułów z boczkiem','masło',20);

-- 1. Brakujące składniki
insert into public.ingredients (name, unit)
select distinct t.ingredient_name, 'g'
from tmp_ing t
where not exists (
  select 1 from public.ingredients i where lower(i.name) = lower(t.ingredient_name)
);

-- 2. Receptury
insert into public.recipes (name, meal_type, diet_type, base_kcal, protein, fat, carbs, food_cost, active, notes)
select r.name, r.meal_type, 'Keto', r.base_kcal, r.protein, r.fat, r.carbs, r.food_cost, true, r.notes
from tmp_recipes r
where not exists (
  select 1 from public.recipes x where x.name = r.name and x.diet_type = 'Keto'
);

-- 3. Powiązanie składników z recepturami
insert into public.recipe_ingredients (recipe_id, ingredient_id, grams)
select rc.id, ig.id, t.grams
from tmp_ing t
join public.recipes rc on rc.name = t.recipe_name and rc.diet_type = 'Keto'
join public.ingredients ig on lower(ig.name) = lower(t.ingredient_name)
where not exists (
  select 1 from public.recipe_ingredients ri
  where ri.recipe_id = rc.id and ri.ingredient_id = ig.id
);

commit;

-- Kontrola pokrycia
select diet_type, meal_type, count(*) as receptur
from public.recipes
where active = true
group by diet_type, meal_type
order by diet_type, meal_type;
