-- Udziec był codziennie, bo plik z recepturami sam oznaczył go jako nadmiar.
-- To zdejmuje oznaczenie. Kuchnia może je włączyć z powrotem, gdy faktycznie
-- będzie miała zapas — w module menu, sekcja „Mamy nadmiar".

delete from public.surplus_terms where term like '%udziec%';

-- Kontrola: co zostaje oznaczone jako nadmiar
select term, created_at from public.surplus_terms order by term;
