-- COFNIĘCIE zabezpieczeń włączonych podczas audytu.
-- Przywraca stan sprzed zmian: panel znów odczytuje zamówienia i klientów.
-- Uruchom w Supabase → SQL Editor, w projekcie wqqexlsrxnlbhirzbbnh.

alter table public.store_orders disable row level security;
alter table public.clients      disable row level security;

-- Kontrola — obie kolumny rowsecurity powinny pokazać false:
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('store_orders','clients');
