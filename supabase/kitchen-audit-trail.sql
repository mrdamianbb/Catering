-- Ślad zmian statusu produkcji.
-- Bez tego nie da się ustalić, kto i kiedy oznaczył dietę jako wydaną.
-- Uruchom w Supabase → SQL Editor.

alter table public.diets add column if not exists status_changed_at timestamptz;
alter table public.diets add column if not exists status_changed_by uuid references auth.users(id);
alter table public.diets add column if not exists issued_at         timestamptz;
alter table public.diets add column if not exists issued_by         uuid references auth.users(id);

create index if not exists diets_issued_at_idx on public.diets (issued_at);

-- Kuchnia mogła dotąd edytować dowolne pole diety, także nazwisko klienta,
-- kaloryczność i daty. Zawężamy to do statusu i znaczników czasu.
create or replace function public.kitchen_limited_diet_update()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  r public.app_role;
begin
  select p.role into r from public.profiles p where p.id = auth.uid();
  if r = 'kitchen' then
    if new.client_name is distinct from old.client_name
       or new.diet_name  is distinct from old.diet_name
       or new.kcal       is distinct from old.kcal
       or new.bags       is distinct from old.bags
       or new.route_code is distinct from old.route_code
       or new.start_date is distinct from old.start_date
       or new.end_date   is distinct from old.end_date
       or new.client_id  is distinct from old.client_id then
      raise exception 'Kuchnia może zmieniać wyłącznie status produkcji.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists diets_kitchen_guard on public.diets;
create trigger diets_kitchen_guard
before update on public.diets
for each row execute procedure public.kitchen_limited_diet_update();
