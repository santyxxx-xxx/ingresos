-- Datos por usuario: categorías y movimientos, sincronizados desde la app.
-- updated_at = hora del cambio en el dispositivo (gana el más reciente)
-- synced_at  = hora del servidor (cursor para descargar cambios)
-- deleted    = borrado lógico, para que los borrados lleguen a todos los dispositivos

create table if not exists public.categories (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '🏷️',
  type text not null check (type in ('expense', 'income')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.transactions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  type text not null check (type in ('expense', 'income')),
  amount_cents bigint not null check (amount_cents >= 0),
  category_id text,
  place text not null default '',
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists categories_user_synced_idx on public.categories (user_id, synced_at);
create index if not exists transactions_user_synced_idx on public.transactions (user_id, synced_at);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date);

-- Marca la hora del servidor y evita que un cambio viejo pise uno más nuevo
create or replace function public.sync_row_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists categories_sync_guard on public.categories;
create trigger categories_sync_guard
  before insert or update on public.categories
  for each row execute function public.sync_row_guard();

drop trigger if exists transactions_sync_guard on public.transactions;
create trigger transactions_sync_guard
  before insert or update on public.transactions
  for each row execute function public.sync_row_guard();

-- Seguridad: cada usuario solo ve y modifica sus propias filas
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "categories_insert_own" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "categories_update_own" on public.categories
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "categories_delete_own" on public.categories
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions_update_own" on public.transactions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.categories from anon;
revoke all on public.transactions from anon;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
