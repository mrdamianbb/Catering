-- Polecenia: kto kogo przyprowadził.
-- Bonus to dzień diety gratis dla obojga, gdy polecony zamówi minimum 7 dni.
-- Dzień dopisuje się ręcznie w panelu, wydłużając datę końca diety.

alter table public.store_orders add column if not exists referrer text;

-- Kto kogo polecił i czy bonus się należy
select o.created_at::date as data, o.customer_name as nowy_klient,
       o.referrer as polecil, o.days,
       case when o.days >= 7 then 'należy się dzień gratis' else 'za krótkie zamówienie' end as bonus
from public.store_orders o
where o.referrer is not null
order by o.created_at desc;
