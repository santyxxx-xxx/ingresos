-- La tabla de respaldo único se reemplaza por la sincronización de categories/transactions.
-- Estaba vacía cuando se retiró.
drop table if exists public.backups;
drop function if exists public.backups_keep_previous();
