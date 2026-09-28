-- Kasuje zliczone próby zamówień. Uruchom, jeśli podczas testów
-- formularz zaczął zwracać „Za dużo prób”.

truncate table public.order_rate_limits;
