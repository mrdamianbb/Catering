-- Przywrócenie wykluczenia „bez laktozy" u pani Ciuruś.
--
-- Wcześniejszy plik napraw-flage-laktozy.sql był BŁĘDNY: zamieniał
-- „bez laktozy" na „bez nabiału", a to dwa różne wykluczenia.
-- Bez laktozy klient może jeść nabiał bezlaktozowy; bez nabiału — żadnego.
-- Plik usunięto. Jeśli został uruchomiony, ten go odwraca.
--
-- Uruchom w Supabase → SQL Editor.

-- 1. Pani Ciuruś: bez laktozy, nie bez nabiału
update public.diets
set notes = 'BEZ LAKTOZY'
where id = 30;

-- 2. Kontrola — kto ma teraz jakie wykluczenie związane z mlekiem
select id, client_name, diet_name, kcal, notes
from public.diets
where archived = false
  and (notes ilike '%laktoz%' or notes ilike '%nabial%' or diet_name ilike '%laktoz%')
order by client_name;
