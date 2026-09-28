-- Udziec drobiowy — szesnaście receptur, żeby układanie miało realny wybór
-- i żeby dało się nim obsłużyć cały tydzień bez powtórek.
--
-- Część pozycji jest celowo bez glutenu i bez nabiału, żeby klient
-- z wykluczeniem też dostał danie z udźcem, a nie zamiennik.
--
-- Uruchom w Supabase → SQL Editor, potem w module menu kliknij
-- „♻️ Przelicz [datę] pod nadmiary". Plik sam oznacza udziec jako nadmiar.

begin;

create temp table tmp_r(
  name text, meal_type text, diet_type text, base_kcal int,
  protein numeric, fat numeric, carbs numeric, food_cost numeric, notes text
) on commit drop;

insert into tmp_r values
-- STANDARD · OBIADY
('Udziec drobiowy pieczony z ziemniakami','lunch','Standard',700,50,26,62,12.00,'udziec drobiowy, ziemniaki, marchew, kapusta biała, oliwa z oliwek'),
('Udziec drobiowy w sosie pieczeniowym z kaszą','lunch','Standard',710,49,26,63,11.50,'udziec drobiowy, kasza gryczana, buraki, cebula, oliwa z oliwek'),
('Gulasz z udźca drobiowego z ryżem','lunch','Standard',690,47,24,66,11.00,'udziec drobiowy, ryż basmati, papryka, cebula, pomidory, oliwa z oliwek'),
('Udziec drobiowy po myśliwsku z kaszą pęczak','lunch','Standard',715,48,27,64,12.50,'udziec drobiowy, pieczarki, kasza pęczak, cebula, śmietana 30%'),
('Udziec drobiowy curry z ryżem jaśminowym','lunch','Standard',705,47,26,64,11.50,'udziec drobiowy, ryż jaśminowy, mleko kokosowe, papryka, curry'),
('Udziec drobiowy z warzywami i batatem','lunch','Standard',695,48,24,65,12.00,'udziec drobiowy, batat, brokuł, marchew, oliwa z oliwek'),
-- STANDARD · KOLACJE
('Sałatka z pieczonym udźcem drobiowym','dinner','Standard',400,33,19,24,9.50,'udziec drobiowy, rukola, pomidor, ogórek, oliwa z oliwek'),
('Udziec drobiowy z warzywami z pieca','dinner','Standard',395,34,18,25,9.00,'udziec drobiowy, cukinia, papryka, cebula, oliwa z oliwek'),
('Wrap z udźcem drobiowym i warzywami','dinner','Standard',410,32,16,32,9.50,'udziec drobiowy, tortilla pszenna, sałata, pomidor, jogurt naturalny'),
-- LOW CARB · OBIADY
('Udziec drobiowy z pieczoną dynią','lunch','Low Carb',650,48,33,27,11.50,'udziec drobiowy, dynia, cukinia, ogórek, oliwa z oliwek'),
('Udziec drobiowy duszony z brokułem','lunch','Low Carb',640,49,32,24,11.00,'udziec drobiowy, brokuł, marchew, śmietana 30%, oliwa z oliwek'),
('Udziec drobiowy z kalafiorem i szpinakiem','lunch','Low Carb',635,50,31,22,11.00,'udziec drobiowy, kalafior, szpinak, czosnek, oliwa z oliwek'),
-- LOW CARB · KOLACJE
('Udziec drobiowy z warzywami z grilla','dinner','Low Carb',385,35,21,15,10.00,'udziec drobiowy, cukinia, papryka, bakłażan, oliwa z oliwek'),
('Sałatka z udźcem drobiowym i awokado','dinner','Low Carb',395,33,25,12,11.50,'udziec drobiowy, awokado, rukola, pomidor, oliwa z oliwek'),
-- KETO · OBIADY
('Udziec drobiowy z puree z kalafiora','lunch','Keto',760,45,59,12,13.00,'udziec drobiowy, kalafior, masło, śmietana 30%, czosnek'),
('Udziec drobiowy konfitowany z warzywami','lunch','Keto',755,46,58,11,13.50,'udziec drobiowy, brokuł, masło, oliwa z oliwek, tymianek');

create temp table tmp_i(recipe_name text, ingredient_name text, grams numeric) on commit drop;

insert into tmp_i values
('Udziec drobiowy pieczony z ziemniakami','udziec drobiowy',190),('Udziec drobiowy pieczony z ziemniakami','ziemniaki',220),('Udziec drobiowy pieczony z ziemniakami','marchew',80),('Udziec drobiowy pieczony z ziemniakami','kapusta biała',90),('Udziec drobiowy pieczony z ziemniakami','oliwa z oliwek',12),
('Udziec drobiowy w sosie pieczeniowym z kaszą','udziec drobiowy',190),('Udziec drobiowy w sosie pieczeniowym z kaszą','kasza gryczana',70),('Udziec drobiowy w sosie pieczeniowym z kaszą','buraki',100),('Udziec drobiowy w sosie pieczeniowym z kaszą','cebula',40),('Udziec drobiowy w sosie pieczeniowym z kaszą','oliwa z oliwek',12),
('Gulasz z udźca drobiowego z ryżem','udziec drobiowy',180),('Gulasz z udźca drobiowego z ryżem','ryż basmati',70),('Gulasz z udźca drobiowego z ryżem','papryka',90),('Gulasz z udźca drobiowego z ryżem','cebula',40),('Gulasz z udźca drobiowego z ryżem','pomidory',100),('Gulasz z udźca drobiowego z ryżem','oliwa z oliwek',12),
('Udziec drobiowy po myśliwsku z kaszą pęczak','udziec drobiowy',185),('Udziec drobiowy po myśliwsku z kaszą pęczak','pieczarki',110),('Udziec drobiowy po myśliwsku z kaszą pęczak','kasza pęczak',70),('Udziec drobiowy po myśliwsku z kaszą pęczak','cebula',35),('Udziec drobiowy po myśliwsku z kaszą pęczak','śmietana 30%',45),
('Udziec drobiowy curry z ryżem jaśminowym','udziec drobiowy',185),('Udziec drobiowy curry z ryżem jaśminowym','ryż jaśminowy',70),('Udziec drobiowy curry z ryżem jaśminowym','mleko kokosowe',80),('Udziec drobiowy curry z ryżem jaśminowym','papryka',80),
('Udziec drobiowy z warzywami i batatem','udziec drobiowy',185),('Udziec drobiowy z warzywami i batatem','batat',180),('Udziec drobiowy z warzywami i batatem','brokuł',120),('Udziec drobiowy z warzywami i batatem','marchew',70),('Udziec drobiowy z warzywami i batatem','oliwa z oliwek',12),

('Sałatka z pieczonym udźcem drobiowym','udziec drobiowy',130),('Sałatka z pieczonym udźcem drobiowym','rukola',40),('Sałatka z pieczonym udźcem drobiowym','pomidor',80),('Sałatka z pieczonym udźcem drobiowym','ogórek',70),('Sałatka z pieczonym udźcem drobiowym','oliwa z oliwek',15),
('Udziec drobiowy z warzywami z pieca','udziec drobiowy',135),('Udziec drobiowy z warzywami z pieca','cukinia',110),('Udziec drobiowy z warzywami z pieca','papryka',90),('Udziec drobiowy z warzywami z pieca','cebula',35),('Udziec drobiowy z warzywami z pieca','oliwa z oliwek',15),
('Wrap z udźcem drobiowym i warzywami','udziec drobiowy',120),('Wrap z udźcem drobiowym i warzywami','tortilla pszenna',60),('Wrap z udźcem drobiowym i warzywami','sałata',40),('Wrap z udźcem drobiowym i warzywami','pomidor',70),('Wrap z udźcem drobiowym i warzywami','jogurt naturalny',40),

('Udziec drobiowy z pieczoną dynią','udziec drobiowy',190),('Udziec drobiowy z pieczoną dynią','dynia',200),('Udziec drobiowy z pieczoną dynią','cukinia',120),('Udziec drobiowy z pieczoną dynią','ogórek',80),('Udziec drobiowy z pieczoną dynią','oliwa z oliwek',15),
('Udziec drobiowy duszony z brokułem','udziec drobiowy',190),('Udziec drobiowy duszony z brokułem','brokuł',150),('Udziec drobiowy duszony z brokułem','marchew',70),('Udziec drobiowy duszony z brokułem','śmietana 30%',50),('Udziec drobiowy duszony z brokułem','oliwa z oliwek',12),
('Udziec drobiowy z kalafiorem i szpinakiem','udziec drobiowy',195),('Udziec drobiowy z kalafiorem i szpinakiem','kalafior',180),('Udziec drobiowy z kalafiorem i szpinakiem','szpinak',80),('Udziec drobiowy z kalafiorem i szpinakiem','czosnek',5),('Udziec drobiowy z kalafiorem i szpinakiem','oliwa z oliwek',18),

('Udziec drobiowy z warzywami z grilla','udziec drobiowy',140),('Udziec drobiowy z warzywami z grilla','cukinia',110),('Udziec drobiowy z warzywami z grilla','papryka',90),('Udziec drobiowy z warzywami z grilla','bakłażan',90),('Udziec drobiowy z warzywami z grilla','oliwa z oliwek',15),
('Sałatka z udźcem drobiowym i awokado','udziec drobiowy',130),('Sałatka z udźcem drobiowym i awokado','awokado',80),('Sałatka z udźcem drobiowym i awokado','rukola',40),('Sałatka z udźcem drobiowym i awokado','pomidor',70),('Sałatka z udźcem drobiowym i awokado','oliwa z oliwek',15),

('Udziec drobiowy z puree z kalafiora','udziec drobiowy',200),('Udziec drobiowy z puree z kalafiora','kalafior',200),('Udziec drobiowy z puree z kalafiora','masło',30),('Udziec drobiowy z puree z kalafiora','śmietana 30%',40),('Udziec drobiowy z puree z kalafiora','czosnek',5),
('Udziec drobiowy konfitowany z warzywami','udziec drobiowy',205),('Udziec drobiowy konfitowany z warzywami','brokuł',160),('Udziec drobiowy konfitowany z warzywami','masło',30),('Udziec drobiowy konfitowany z warzywami','oliwa z oliwek',20);

insert into public.ingredients (name, unit)
select distinct t.ingredient_name, 'g'
from tmp_i t
where not exists (select 1 from public.ingredients i where lower(i.name) = lower(t.ingredient_name));

insert into public.recipes (name, meal_type, diet_type, base_kcal, protein, fat, carbs, food_cost, active, notes)
select r.name, r.meal_type, r.diet_type, r.base_kcal, r.protein, r.fat, r.carbs, r.food_cost, true, r.notes
from tmp_r r
where not exists (select 1 from public.recipes x where x.name = r.name and x.diet_type = r.diet_type);

insert into public.recipe_ingredients (recipe_id, ingredient_id, grams)
select rc.id, ig.id, t.grams
from tmp_i t
join public.recipes rc on rc.name = t.recipe_name
join public.ingredients ig on lower(ig.name) = lower(t.ingredient_name)
where rc.name in (select name from tmp_r)
  and not exists (
    select 1 from public.recipe_ingredients ri
    where ri.recipe_id = rc.id and ri.ingredient_id = ig.id
  );

insert into public.surplus_terms (term) values ('udziec drobiowy')
on conflict (term) do nothing;

commit;

-- Kontrola pokrycia
select diet_type, meal_type, count(*) as receptur
from public.recipes
where active = true and lower(name || ' ' || coalesce(notes,'')) like '%udziec drobiowy%'
group by diet_type, meal_type
order by diet_type, meal_type;
