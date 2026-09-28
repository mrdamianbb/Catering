-- Pozwala formularzowi na stronie zapisywać zamówienia bez klucza serwisowego.
-- Uruchom w Supabase → SQL Editor.
--
-- Bezpieczeństwo: można wyłącznie DODAĆ zamówienie. Odczytu, edycji ani
-- usuwania nie ma — listę widzi tylko zalogowany administrator, który
--  każde zamówienie akceptuje ręcznie.

alter table public.store_orders enable row level security;

drop policy if exists "public can create store orders" on public.store_orders;
create policy "public can create store orders"
on public.store_orders for insert
to anon, authenticated
with check (true);

drop policy if exists "admin reads store orders" on public.store_orders;
create policy "admin reads store orders"
on public.store_orders for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admin updates store orders" on public.store_orders;
create policy "admin updates store orders"
on public.store_orders for update
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
