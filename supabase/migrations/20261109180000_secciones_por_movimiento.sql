-- Secciones (Casa, Personal, Hijo…) por movimiento en lugar de por categoría.
-- Se reutiliza la tabla category_groups como tabla de secciones.

alter table public.transactions add column if not exists section_id text;
alter table public.transactions drop constraint if exists transactions_section_fk;
alter table public.transactions
  add constraint transactions_section_fk foreign key (user_id, section_id)
  references public.category_groups (user_id, id) on delete set null (section_id);
create index if not exists transactions_user_section_idx on public.transactions (user_id, section_id);

alter table public.recurring add column if not exists section_id text;
alter table public.recurring drop constraint if exists recurring_section_fk;
alter table public.recurring
  add constraint recurring_section_fk foreign key (user_id, section_id)
  references public.category_groups (user_id, id) on delete set null (section_id);

-- Conservar lo que ya había: la sección es el grupo de la categoría (o de su categoría principal)
update public.transactions t
set section_id = coalesce(p.group_id, c.group_id)
from public.categories c
left join public.categories p on p.user_id = c.user_id and p.id = c.parent_id
where c.user_id = t.user_id and c.id = t.category_id and t.section_id is null;

update public.recurring r
set section_id = coalesce(p.group_id, c.group_id)
from public.categories c
left join public.categories p on p.user_id = c.user_id and p.id = c.parent_id
where c.user_id = r.user_id and c.id = r.category_id and r.section_id is null;

-- Los recurrentes copian su sección a cada movimiento que crean
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
      insert into public.transactions (user_id, id, type, amount_cents, category_id, place, date, recurring_id, section_id)
      values (r.user_id, 'rec-' || r.id || '-' || to_char(m, 'YYYY-MM'), r.type, r.amount_cents,
              r.category_id, r.place, d, r.id, r.section_id)
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
