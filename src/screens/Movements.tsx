import { useMemo, useState } from 'react';
import { Header } from '../components/Header';
import { MonthPicker } from '../components/MonthPicker';
import { Segmented } from '../components/Segmented';
import { TxRow } from '../components/TxRow';
import { useData, useMonthTx } from '../lib/data';
import type { Transaction } from '../lib/types';
import { dayLabel, money } from '../lib/utils';

type Filter = 'all' | 'expense' | 'income';

interface Props {
  month: string;
  setMonth: (m: string) => void;
  onEdit: (t: Transaction) => void;
  onSettings: () => void;
}

export function Movements({ month, setMonth, onEdit, onSettings }: Props) {
  const { data: txs, error } = useMonthTx(month);
  const { catMap: cats } = useData();
  const [filter, setFilter] = useState<Filter>('all');

  const { groups, income, expense } = useMemo(() => {
    const list = (txs ?? [])
      .filter((t) => filter === 'all' || t.type === filter)
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : a.date < b.date ? 1 : -1));
    const g: Array<{ date: string; items: Transaction[]; net: number }> = [];
    let inc = 0;
    let exp = 0;
    for (const t of list) {
      if (t.type === 'income') inc += t.amount;
      else exp += t.amount;
      let last = g[g.length - 1];
      if (!last || last.date !== t.date) {
        last = { date: t.date, items: [], net: 0 };
        g.push(last);
      }
      last.items.push(t);
      last.net += t.type === 'income' ? t.amount : -t.amount;
    }
    return { groups: g, income: inc, expense: exp };
  }, [txs, filter]);

  return (
    <div className="screen-inner">
      <Header title="Movimientos" onSettings={onSettings} />
      <MonthPicker month={month} onChange={setMonth} />
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'expense', label: 'Gastos' },
          { value: 'income', label: 'Ingresos' }
        ]}
      />

      {error && <p className="error-text">{error}</p>}

      <div className="summary-line">
        {filter !== 'expense' && (
          <div className="pill glass">
            <small>Ingresos</small>
            <b className="c-income">{money(income)}</b>
          </div>
        )}
        {filter !== 'income' && (
          <div className="pill glass">
            <small>Gastos</small>
            <b className="c-expense">{money(expense)}</b>
          </div>
        )}
      </div>

      {txs !== undefined && groups.length === 0 && (
        <section className="card glass empty">
          <div className="art">🗂️</div>
          <h3>Nada por aquí</h3>
          <p>No hay movimientos{filter === 'expense' ? ' de gasto' : filter === 'income' ? ' de ingreso' : ''} en este mes. Toca “+” para agregar uno.</p>
        </section>
      )}

      {groups.map((g) => (
        <section className="day-group glass" key={g.date}>
          <div className="day-head">
            <span>{dayLabel(g.date)}</span>
            <span>
              {g.net >= 0 ? '+' : '−'}
              {money(Math.abs(g.net))}
            </span>
          </div>
          <div className="tx-list">
            {g.items.map((t) => (
              <TxRow key={t.id} tx={t} cats={cats} onClick={() => onEdit(t)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
