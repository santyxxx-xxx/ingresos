-- La app pasa a ser una web online: lee y escribe directo en Supabase.
-- Se agregan subcategorías (un nivel) y se quitan las columnas de sincronización offline.

-- 1) Quitar lo de sincronización
delete from public.transactions where deleted;
delete from public.categories where deleted;
drop trigger if exists categories_sync_guard on public.categories;
drop trigger if exists transactions_sync_guard on public.transactions;
drop function if exists public.sync_row_guard();
alter table public.categories drop column if exists deleted, drop column if exists synced_at;
alter table public.transactions drop column if exists deleted, drop column if exists synced_at;

-- ids generados por el servidor
alter table public.categories alter column id set default gen_random_uuid()::text;
alter table public.transactions alter column id set default gen_random_uuid()::text;

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists categories_touch on public.categories;
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();
drop trigger if exists transactions_touch on public.transactions;
create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- 2) Subcategorías
alter table public.categories add column if not exists parent_id text;

alter table public.categories drop constraint if exists categories_parent_fk;
alter table public.categories
  add constraint categories_parent_fk foreign key (user_id, parent_id)
  references public.categories (user_id, id) on delete cascade;

alter table public.categories drop constraint if exists categories_parent_not_self;
alter table public.categories
  add constraint categories_parent_not_self check (parent_id is null or parent_id <> id);

create index if not exists categories_user_parent_idx on public.categories (user_id, parent_id);

-- Solo un nivel y mismo tipo (gasto/ingreso) que la categoría padre
create or replace function public.categories_check_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p_type text;
  p_parent text;
begin
  if new.parent_id is null then
    return new;
  end if;
  select type, parent_id into p_type, p_parent
  from public.categories
  where user_id = new.user_id and id = new.parent_id;
  if not found then
    return new; -- la llave foránea reporta el error
  end if;
  if p_parent is not null then
    raise exception 'Solo se permite un nivel de subcategorías';
  end if;
  if p_type <> new.type then
    raise exception 'La subcategoría debe ser del mismo tipo que su categoría';
  end if;
  if exists (select 1 from public.categories where user_id = new.user_id and parent_id = new.id) then
    raise exception 'Una categoría con subcategorías no puede ser subcategoría';
  end if;
  return new;
end;
$$;

drop trigger if exists categories_check_parent on public.categories;
create trigger categories_check_parent before insert or update on public.categories
  for each row execute function public.categories_check_parent();

-- 3) Movimientos → categoría (al borrar la categoría quedan "Sin categoría")
update public.transactions t
set category_id = null
where category_id is not null
  and not exists (
    select 1 from public.categories c where c.user_id = t.user_id and c.id = t.category_id
  );

alter table public.transactions drop constraint if exists transactions_category_fk;
alter table public.transactions
  add constraint transactions_category_fk foreign key (user_id, category_id)
  references public.categories (user_id, id) on delete set null (category_id);

create index if not exists transactions_user_category_idx on public.transactions (user_id, category_id);

-- 4) Categorías base para cada usuario nuevo
create or replace function public.seed_base_categories(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (user_id, id, name, emoji, type, sort_order) values
    (uid, 'base-comida', 'Comida', '🍽️', 'expense', 0),
    (uid, 'base-transporte', 'Transporte', '🚕', 'expense', 1),
    (uid, 'base-hogar', 'Hogar', '🏠', 'expense', 2),
    (uid, 'base-salud', 'Salud', '💊', 'expense', 3),
    (uid, 'base-ocio', 'Ocio', '🎬', 'expense', 4),
    (uid, 'base-educacion', 'Educación', '📚', 'expense', 5),
    (uid, 'base-ropa', 'Ropa', '👕', 'expense', 6),
    (uid, 'base-otros', 'Otros', '📦', 'expense', 7),
    (uid, 'base-sueldo', 'Sueldo', '💼', 'income', 8),
    (uid, 'base-freelance', 'Freelance', '💻', 'income', 9),
    (uid, 'base-otros-ingresos', 'Otros ingresos', '✨', 'income', 10)
  on conflict do nothing;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_base_categories(new.id);
  return new;
end;
$$;

revoke execute on function public.seed_base_categories(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- usuarios existentes sin categorías
select public.seed_base_categories(u.id)
from auth.users u
where not exists (select 1 from public.categories c where c.user_id = u.id);

-- 5) Vistas de apoyo (respetan RLS del usuario que consulta)
create or replace view public.category_usage
with (security_invoker = true) as
  select user_id, category_id, count(*)::int as tx_count
  from public.transactions
  where category_id is not null
  group by user_id, category_id;

create or replace view public.place_usage
with (security_invoker = true) as
  select user_id, type, min(btrim(place)) as place, count(*)::int as uses, max(created_at) as last_used
  from public.transactions
  where btrim(place) <> ''
  group by user_id, type, lower(btrim(place));

revoke all on public.category_usage from anon;
revoke all on public.place_usage from anon;
grant select on public.category_usage to authenticated;
grant select on public.place_usage to authenticated;
