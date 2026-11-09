import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Plus } from 'lucide-react';
import { Header } from '../components/Header';
import { MonthPicker } from '../components/MonthPicker';
import { Donut, type Slice } from '../components/Donut';
import { TxRow } from '../components/TxRow';
import { CloudBanner } from '../components/CloudBanner';
import { catInfo, useCategories, useMonthTx } from '../lib/hooks';
import type { Transaction } from '../lib/types';
import { money, moneyParts, normalizePlace } from '../lib/utils';

interface Props {
  month: string;
  setMonth: (m: string) => void;
  onEdit: (t: Transaction) => void;
  onAdd: () => void;
  onSeeAll: () => void;
  onSettings: () => void;
}

const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function Dashboard({ month, setMonth, onEdit, onAdd, onSeeAll, onSettings }: Props) {
  const txs = useMonthTx(month);
  const { map: cats } = useCategories();

  const data = useMemo(() => {
    const list = txs ?? [];
    let income = 0;
    let expense = 0;
    const byCat = new Map<string, number>();
    const byIncomeCat = new Map<string, number>();
    const byPlace = new Map<string, { label: string; total: number; n: number }>();
    for (const t of list) {
      const key = t.categoryId ?? '__none__';
      if (t.type === 'income') {
        income += t.amount;
        byIncomeCat.set(key, (byIncomeCat.get(key) ?? 0) + t.amount);
      } else {
        expense += t.amount;
        byCat.set(key, (byCat.get(key) ?? 0) + t.amount);
        if (t.place.trim()) {
          const pk = normalizePlace(t.place);
          const cur = byPlace.get(pk);
          if (cur) {
            cur.total += t.amount;
            cur.n++;
          } else byPlace.set(pk, { label: t.place.trim(), total: t.amount, n: 1 });
        }
      }
    }
    const toRank = (m: Map<string, number>, total: number) =>
      [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, value]) => ({
          id,
          value,
          pct: total ? (value / total) * 100 : 0,
          ...catInfo(cats, id === '__none__' ? null : id)
        }));
    const expenseRank = toRank(byCat, expense);
    const incomeRank = toRank(byIncomeCat, income);
    const places = [...byPlace.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    const recent = [...list]
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
      .slice(0, 5);
    return { income, expense, balance: income - expense, expenseRank, incomeRank, places, recent, count: list.length };
  }, [txs, cats]);

  const slices: Slice[] = useMemo(() => {
    const top = data.expenseRank.slice(0, 5).map((r, i) => ({ key: r.id, value: r.value, color: COLORS[i] }));
    const rest = data.expenseRank.slice(5).reduce((a, r) => a + r.value, 0);
    if (rest > 0) top.push({ key: '__rest__', value: rest, color: 'var(--c7)' });
    return top;
  }, [data.expenseRank]);

  const bal = moneyParts(data.balance);
  const maxPlace = data.places[0]?.total ?? 1;
  const maxIncome = data.incomeRank[0]?.value ?? 1;

  return (
    <div className="screen-inner">
      <Header eyebrow={greeting()} title="Resumen" onSettings={onSettings} />
      <CloudBanner onOpen={onSettings} />
      <MonthPicker month={month} onChange={setMonth} />

      <section className="card glass balance">
        <div className="k">Balance del mes</div>
        <div className={`big-number ${data.balance < 0 ? 'neg' : ''}`}>
          {bal.sign}
          {bal.int}
          <span className="dec">{bal.dec}</span>
        </div>
      </section>

      <div className="stat-row">
        <div className="stat glass income">
          <div className="top">
            <span className="dot">
              <ArrowDownRight size={16} strokeWidth={2} />
            </span>
            Ingresos
          </div>
          <div className="val">{money(data.income)}</div>
        </div>
        <div className="stat glass expense">
          <div className="top">
            <span className="dot">
              <ArrowUpRight size={16} strokeWidth={2} />
            </span>
            Gastos
          </div>
          <div className="val">{money(data.expense)}</div>
        </div>
      </div>

      {txs !== undefined && data.count === 0 && (
        <section className="card glass empty">
          <div className="art">🌿</div>
          <h3>Sin movimientos este mes</h3>
          <p>Registra tu primer gasto o ingreso y aquí verás en qué se va tu dinero.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onAdd}>
            <Plus size={20} strokeWidth={2} /> Agregar movimiento
          </button>
        </section>
      )}

      {data.expenseRank.length > 0 && (
        <section className="card glass">
          <div className="card-title">
            <h2>Dónde gasto más</h2>
          </div>
          <div className="donut-wrap">
            <Donut slices={slices} center={money(data.expense)} sub="gastado" />
            <div className="legend">
              {slices.map((s) => {
                const r = data.expenseRank.find((x) => x.id === s.key);
                const name = r ? `${r.emoji} ${r.name}` : 'Resto';
                const pct = data.expense ? (s.value / data.expense) * 100 : 0;
                return (
                  <div className="legend-item" key={s.key}>
                    <i style={{ background: s.color }} />
                    <span className="name">{name}</span>
                    <span className="pct">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rank-list" style={{ marginTop: 20 }}>
            {data.expenseRank.map((r, i) => (
              <div className="rank" key={r.id}>
                <span className="badge">{r.emoji}</span>
                <span className="name">{r.name}</span>
                <span className="amt">{money(r.value)}</span>
                <div className="bar">
                  <span style={{ width: `${r.pct}%`, background: i < 5 ? COLORS[i] : 'var(--c7)' }} />
                </div>
                <span className="sub">{r.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.places.length > 0 && (
        <section className="card glass">
          <div className="card-title">
            <h2>En qué lugares gasto más</h2>
          </div>
          <div className="rank-list">
            {data.places.map((p, i) => (
              <div className="rank" key={p.label}>
                <span className="badge num">{i + 1}</span>
                <span className="name">{p.label}</span>
                <span className="amt">{money(p.total)}</span>
                <div className="bar">
                  <span style={{ width: `${(p.total / maxPlace) * 100}%`, background: 'var(--ink)', opacity: 0.8 - i * 0.1 }} />
                </div>
                <span className="sub">
                  {p.n} {p.n === 1 ? 'vez' : 'veces'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.incomeRank.length > 0 && (
        <section className="card glass">
          <div className="card-title">
            <h2>Ingresos del mes</h2>
          </div>
          <div className="rank-list">
            {data.incomeRank.map((r) => (
              <div className="rank" key={r.id}>
                <span className="badge">{r.emoji}</span>
                <span className="name">{r.name}</span>
                <span className="amt c-income">{money(r.value)}</span>
                <div className="bar">
                  <span style={{ width: `${(r.value / maxIncome) * 100}%`, background: 'var(--accent-ink)' }} />
                </div>
                <span className="sub">{r.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.recent.length > 0 && (
        <section className="card glass" style={{ paddingBottom: 8 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>
            <h2>Últimos movimientos</h2>
            <button className="link" onClick={onSeeAll}>
              Ver todos
            </button>
          </div>
          <div className="tx-list">
            {data.recent.map((t) => (
              <TxRow key={t.id} tx={t} cats={cats} onClick={() => onEdit(t)} showDate />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
