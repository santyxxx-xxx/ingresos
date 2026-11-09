-- Grupos (Casa, Personal…), presupuestos mensuales por categoría y movimientos recurrentes.

-- 1) Grupos de categorías
create table if not exists public.category_groups (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null default '📁',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.category_groups enable row level security;
drop policy if exists "groups_select_own" on public.category_groups;
drop policy if exists "groups_insert_own" on public.category_groups;
drop policy if exists "groups_update_own" on public.category_groups;
drop policy if exists "groups_delete_own" on public.category_groups;
create policy "groups_select_own" on public.category_groups
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "groups_insert_own" on public.category_groups
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "groups_update_own" on public.category_groups
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "groups_delete_own" on public.category_groups
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.category_groups from anon;
grant select, insert, update, delete on public.category_groups to authenticated;

drop trigger if exists category_groups_touch on public.category_groups;
create trigger category_groups_touch before update on public.category_groups
  for each row execute function public.touch_updated_at();

alter table public.categories add column if not exists group_id text;
alter table public.categories drop constraint if exists categories_group_fk;
alter table public.categories
  add constraint categories_group_fk foreign key (user_id, group_id)
  references public.category_groups (user_id, id) on delete set null (group_id);
create index if not exists categories_user_group_idx on public.categories (user_id, group_id);

-- 2) Presupuesto mensual (en centavos) por categoría principal
alter table public.categories add column if not exists monthly_budget_cents bigint;
alter table public.categories drop constraint if exists categories_budget_positive;
alter table public.categories
  add constraint categories_budget_positive check (monthly_budget_cents is null or monthly_budget_cents > 0);

-- 3) Movimientos recurrentes (arriendo, suscripciones, sueldo…)
create table if not exists public.recurring (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null default gen_random_uuid()::text,
  type text not null check (type in ('expense', 'income')),
  amount_cents bigint not null check (amount_cents > 0),
  category_id text,
  place text not null default '',
  day_of_month integer not null check (day_of_month between 1 and 31),
  start_date date not null default current_date,
  active boolean not null default true,
  -- primer día del último mes ya generado
  last_month date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.recurring drop constraint if exists recurring_category_fk;
alter table public.recurring
  add constraint recurring_category_fk foreign key (user_id, category_id)
  references public.categories (user_id, id) on delete set null (category_id);

alter table public.recurring enable row level security;
drop policy if exists "recurring_select_own" on public.recurring;
drop policy if exists "recurring_insert_own" on public.recurring;
drop policy if exists "recurring_update_own" on public.recurring;
drop policy if exists "recurring_delete_own" on public.recurring;
create policy "recurring_select_own" on public.recurring
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recurring_insert_own" on public.recurring
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recurring_update_own" on public.recurring
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recurring_delete_own" on public.recurring
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.recurring from anon;
grant select, insert, update, delete on public.recurring to authenticated;

drop trigger if exists recurring_touch on public.recurring;
create trigger recurring_touch before update on public.recurring
  for each row execute function public.touch_updated_at();

alter table public.transactions add column if not exists recurring_id text;
alter table public.transactions drop constraint if exists transactions_recurring_fk;
alter table public.transactions
  add constraint transactions_recurring_fk foreign key (user_id, recurring_id)
  references public.recurring (user_id, id) on delete set null (recurring_id);

-- Crea los movimientos que tocan (hasta hoy) para los recurrentes activos del usuario.
-- Idempotente: cada mes usa un id fijo, así que nunca duplica.
create or replace function public.generate_recurring(p_today date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r record;
  m date;
  d date;
  last_m date;
  cur_m date := date_trunc('month', p_today)::date;
  n integer := 0;
begin
  for r in
    select * from public.recurring where user_id = auth.uid() and active
  loop
    last_m := r.last_month;
    m := greatest(
      date_trunc('month', r.start_date)::date,
      coalesce((r.last_month + interval '1 month')::date, '0001-01-01'::date)
    );
    while m <= cur_m loop
      d := m + (least(r.day_of_month, extract(day from (m + interval '1 month' - interval '1 day'))::int) - 1);
      if d < r.start_date then
        m := (m + interval '1 month')::date;
        continue;
      end if;
      exit when d > p_today;
      insert into public.transactions (user_id, id, type, amount_cents, category_id, place, date, recurring_id)
      values (r.user_id, 'rec-' || r.id || '-' || to_char(m, 'YYYY-MM'), r.type, r.amount_cents,
              r.category_id, r.place, d, r.id)
      on conflict do nothing;
      if found then
        n := n + 1;
      end if;
      last_m := m;
      m := (m + interval '1 month')::date;
    end loop;
    if last_m is distinct from r.last_month then
      update public.recurring set last_month = last_m where user_id = r.user_id and id = r.id;
    end if;
  end loop;
  return n;
end;
$$;

revoke execute on function public.generate_recurring(date) from public, anon;
grant execute on function public.generate_recurring(date) to authenticated;

-- 4) Grupos base: Casa y Personal
create or replace function public.seed_base_categories(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.category_groups (user_id, id, name, emoji, sort_order) values
    (uid, 'grp-casa', 'Casa', '🏠', 0),
    (uid, 'grp-personal', 'Personal', '🙋', 1)
  on conflict do nothing;

  insert into public.categories (user_id, id, name, emoji, type, sort_order, group_id) values
    (uid, 'base-comida', 'Comida', '🍽️', 'expense', 0, 'grp-casa'),
    (uid, 'base-transporte', 'Transporte', '🚕', 'expense', 1, 'grp-personal'),
    (uid, 'base-hogar', 'Hogar', '🛋️', 'expense', 2, 'grp-casa'),
    (uid, 'base-salud', 'Salud', '💊', 'expense', 3, 'grp-personal'),
    (uid, 'base-ocio', 'Ocio', '🎬', 'expense', 4, 'grp-personal'),
    (uid, 'base-educacion', 'Educación', '📚', 'expense', 5, 'grp-personal'),
    (uid, 'base-ropa', 'Ropa', '👕', 'expense', 6, 'grp-personal'),
    (uid, 'base-otros', 'Otros', '📦', 'expense', 7, 'grp-personal'),
    (uid, 'base-sueldo', 'Sueldo', '💼', 'income', 8, 'grp-personal'),
    (uid, 'base-freelance', 'Freelance', '💻', 'income', 9, 'grp-personal'),
    (uid, 'base-otros-ingresos', 'Otros ingresos', '✨', 'income', 10, 'grp-personal')
  on conflict do nothing;
$$;

revoke execute on function public.seed_base_categories(uuid) from public, anon, authenticated;

-- usuarios existentes: crear grupos y asignar las categorías base que no tengan grupo
insert into public.category_groups (user_id, id, name, emoji, sort_order)
select u.id, g.id, g.name, g.emoji, g.ord
from auth.users u
cross join (values ('grp-casa', 'Casa', '🏠', 0), ('grp-personal', 'Personal', '🙋', 1)) as g(id, name, emoji, ord)
on conflict do nothing;

update public.categories
set group_id = case when id in ('base-comida', 'base-hogar') then 'grp-casa' else 'grp-personal' end
where group_id is null and parent_id is null and id like 'base-%';
