-- Program lojalnościowy: zapis poziomu przy zamówieniu ze strony.
-- Sam rabat liczy się z historii diet, te kolumny to zapis na moment zamówienia.

alter table public.store_orders add column if not exists loyalty_days    integer not null default 0;
alter table public.store_orders add column if not exists loyalty_percent integer not null default 0;

-- Kto ma ile dni historii (podgląd progów: 30 / 90 / 180)
select c.name, c.phone,
       sum(greatest(0, least(d.end_date, current_date) - d.start_date + 1)) as dni_historii
from public.clients c
join public.diets d on d.client_id = c.id
where d.start_date <= current_date
group by c.id, c.name, c.phone
order by dni_historii desc;
