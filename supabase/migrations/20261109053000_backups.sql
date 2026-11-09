-- Respaldo en la nube: una fila por usuario con el JSON completo de la app.
-- Idempotente: se puede aplicar más de una vez sin error.
create table if not exists public.backups (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  tx_count integer not null default 0,
  cat_count integer not null default 0,
  device text,
  updated_at timestamptz not null default now(),
  -- versión anterior (se rota como máximo cada 12 h) como red de seguridad
  previous_data jsonb,
  previous_updated_at timestamptz
);

alter table public.backups enable row level security;

drop policy if exists "backups_select_own" on public.backups;
drop policy if exists "backups_insert_own" on public.backups;
drop policy if exists "backups_update_own" on public.backups;
drop policy if exists "backups_delete_own" on public.backups;

create policy "backups_select_own" on public.backups
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "backups_insert_own" on public.backups
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "backups_update_own" on public.backups
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "backups_delete_own" on public.backups
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.backups from anon;
grant select, insert, update, delete on public.backups to authenticated;

create or replace function public.backups_keep_previous()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.data is distinct from new.data
     and (old.previous_updated_at is null or old.updated_at < now() - interval '12 hours') then
    new.previous_data := old.data;
    new.previous_updated_at := old.updated_at;
  else
    new.previous_data := old.previous_data;
    new.previous_updated_at := old.previous_updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists backups_keep_previous on public.backups;
create trigger backups_keep_previous
  before update on public.backups
  for each row execute function public.backups_keep_previous();
