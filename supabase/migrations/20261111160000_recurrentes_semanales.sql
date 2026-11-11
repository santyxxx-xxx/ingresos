-- Recurrentes semanales. Cambio solo aditivo: los recurrentes existentes quedan como mensuales
-- y se siguen generando exactamente igual.

alter table public.recurring add column if not exists frequency text not null default 'monthly';
alter table public.recurring drop constraint if exists recurring_frequency_check;
alter table public.recurring
  add constraint recurring_frequency_check check (frequency in ('monthly', 'weekly'));

-- 1 = lunes … 7 = domingo (ISO). Solo para los semanales.
alter table public.recurring add column if not exists day_of_week smallint;
alter table public.recurring drop constraint if exists recurring_day_of_week_check;
alter table public.recurring
  add constraint recurring_day_of_week_check check (day_of_week is null or day_of_week between 1 and 7);

-- Última fecha ya generada (semanales)
alter table public.recurring add column if not exists last_date date;

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
  last_d date;
  cur_m date := date_trunc('month', p_today)::date;
  n integer := 0;
begin
  for r in
    select * from public.recurring where user_id = auth.uid() and active
  loop
    if r.frequency = 'weekly' and r.day_of_week is not null then
      -- Primera fecha con ese día de la semana desde el inicio, o una semana después de la última generada
      last_d := r.last_date;
      d := r.start_date + ((r.day_of_week - extract(isodow from r.start_date)::int + 7) % 7);
      if r.last_date is not null and r.last_date + 7 > d then
        d := r.last_date + 7;
      end if;
      while d <= p_today loop
        insert into public.transactions (user_id, id, type, amount_cents, category_id, place, date, recurring_id, section_id)
        values (r.user_id, 'rec-' || r.id || '-' || to_char(d, 'YYYY-MM-DD'), r.type, r.amount_cents,
                r.category_id, r.place, d, r.id, r.section_id)
        on conflict do nothing;
        if found then
          n := n + 1;
        end if;
        last_d := d;
        d := d + 7;
      end loop;
      if last_d is distinct from r.last_date then
        update public.recurring set last_date = last_d where user_id = r.user_id and id = r.id;
      end if;
      continue;
    end if;

    -- Mensual (igual que antes)
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
