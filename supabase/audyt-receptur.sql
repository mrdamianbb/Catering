-- Ile receptur zostaje przy każdym wykluczeniu żywieniowym.
-- Zero w którejkolwiek kolumnie = nie da się obsłużyć takiego klienta.
-- Uruchom w Supabase → SQL Editor.

with r as (
  select
    diet_type,
    meal_type,
    lower(coalesce(name,'') || ' ' || coalesce(notes,'')) as txt
  from public.recipes
  where active = true
)
select
  diet_type,
  meal_type,
  count(*) as wszystkie,
  count(*) filter (where txt !~ 'mlek|śmietan|smietan|jogurt|kefir|maślan|maslan|masło|maslo|\yser|twaró|twaro|mozzarell|feta|ricott|parmezan|cheddar|skyr|serwatk') as bez_nabialu,
  count(*) filter (where txt !~ 'jaj|majonez|omlet|frittat|szakszuk') as bez_jaj,
  count(*) filter (where txt !~ 'orzech|migdał|migdal|nerkowc|pistacj|laskow|nutell|marcepan') as bez_orzechow,
  count(*) filter (where txt !~ 'ryb|łoso|loso|dorsz|tuńczy|tunczy|makrel|pstrąg|pstrag|śledź|sledz|sardynk|anchois|surimi') as bez_ryb,
  count(*) filter (where txt !~ 'wieprz|schab|boczek|szynk|karków|karkow|kiełbas|kielbas|smalec|żeberk|zeberk|chorizo|pancett') as bez_wieprzowiny,
  count(*) filter (where txt !~ 'pszen|mąka|maka|makaron|chleb|bułk|bulk|tortill|kasza manna|orkisz|jęczmien|jeczmien|żyto|zyto|owsian|owies|panierk|pierog|nalesnik|naleśnik|ciast') as bez_glutenu,
  count(*) filter (where txt !~ 'soj|tofu|tempeh|edamame|miso') as bez_soi,
  count(*) filter (where txt !~ 'seler|włoszczyzn|wloszczyzn|vegeta') as bez_selera
from r
group by diet_type, meal_type
order by diet_type, meal_type;
