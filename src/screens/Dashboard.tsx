import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Plus } from 'lucide-react';
import { Header } from '../components/Header';
import { MonthPicker } from '../components/MonthPicker';
import { Donut, type Slice } from '../components/Donut';
import { TxRow } from '../components/TxRow';
import { UNCATEGORIZED, useData, useMonthTx } from '../lib/data';
import type { Category, Transaction } from '../lib/types';
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
const NONE = '__none__';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

interface RankItem {
  id: string;
  name: string;
  emoji: string;
  value: number;
  pct: number;
  children: Array<{ id: string; name: string; emoji: string; value: number; pct: number }>;
}

/** Agrupa por categoría principal, con el desglose por subcategoría */
function rankByRoot(list: Transaction[], catMap: Map<string, Category>, total: number): RankItem[] {
  const roots = new Map<string, { value: number; children: Map<string, number> }>();
  for (const t of list) {
    const c = t.categoryId ? catMap.get(t.categoryId) : undefined;
    const rootId = c ? c.parentId ?? c.id : NONE;
    const childId = c && c.parentId ? c.id : rootId === NONE ? NONE : `${rootId}:general`;
    const r = roots.get(rootId) ?? { value: 0, children: new Map() };
    r.value += t.amount;
    r.children.set(childId, (r.children.get(childId) ?? 0) + t.amount);
    roots.set(rootId, r);
  }
  return [...roots.entries()]
    .map(([id, r]) => {
      const root = catMap.get(id);
      const children = [...r.children.entries()]
        .map(([cid, value]) => {
          const sub = catMap.get(cid);
          return {
            id: cid,
            name: sub ? sub.name : 'General',
            emoji: sub ? sub.emoji : root?.emoji ?? UNCATEGORIZED.emoji,
            value,
            pct: r.value ? (value / r.value) * 100 : 0
          };
        })
        .sort((a, b) => b.value - a.value);
      return {
        id,
        name: root?.name ?? UNCATEGORIZED.name,
        emoji: root?.emoji ?? UNCATEGORIZED.emoji,
        value: r.value,
        pct: total ? (r.value / total) * 100 : 0,
        // el desglose solo tiene sentido si hay alguna subcategoría con movimientos
        children: children.some((c) => !c.id.endsWith(':general') && c.id !== NONE) ? children : []
      };
    })
    .sort((a, b) => b.value - a.value);
}

function RankList({ items, colorFor, tone }: { items: RankItem[]; colorFor: (i: number) => string; tone?: 'income' }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div className="rank-list">
      {items.map((r, i) => {
        const expandable = r.children.length > 0;
        const isOpen = open.has(r.id);
        const row = (
          <div className="rank">
            <span className="badge">{r.emoji}</span>
            <span className="name">
              {r.name}
              {expandable && <ChevronRight size={14} strokeWidth={2} className={`caret ${isOpen ? 'open' : ''}`} />}
            </span>
            <span className={`amt ${tone === 'income' ? 'c-income' : ''}`}>{money(r.value)}</span>
            <div className="bar">
              <span style={{ width: `${r.pct}%`, background: colorFor(i) }} />
            </div>
            <span className="sub">{r.pct.toFixed(1)}%</span>
          </div>
        );
        return (
          <div key={r.id}>
            {expandable ? (
              <button className="rank-toggle" onClick={() => toggle(r.id)} aria-expanded={isOpen}>
                {row}
              </button>
            ) : (
              row
            )}
            {expandable && isOpen && (
              <div className="rank-list" style={{ marginTop: 12, gap: 10 }}>
                {r.children.map((c) => (
                  <div className="rank child" key={c.id}>
                    <span className="badge small">{c.emoji}</span>
                    <span className="name">{c.name}</span>
                    <span className="amt">{money(c.value)}</span>
                    <div className="bar">
                      <span style={{ width: `${c.pct}%`, background: colorFor(i), opacity: 0.6 }} />
                    </div>
                    <span className="sub">{c.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Dashboard({ month, setMonth, onEdit, onAdd, onSeeAll, onSettings }: Props) {
  const { data: txs, error, loading } = useMonthTx(month);
  const { catMap } = useData();

  const data = useMemo(() => {
    const list = txs ?? [];
    const incomes = list.filter((t) => t.type === 'income');
    const expenses = list.filter((t) => t.type === 'expense');
    const income = incomes.reduce((a, t) => a + t.amount, 0);
    const expense = expenses.reduce((a, t) => a + t.amount, 0);
    const byPlace = new Map<string, { label: string; total: number; n: number }>();
    for (const t of expenses) {
      if (!t.place.trim()) continue;
      const pk = normalizePlace(t.place);
      const cur = byPlace.get(pk);
      if (cur) {
        cur.total += t.amount;
        cur.n++;
      } else byPlace.set(pk, { label: t.place.trim(), total: t.amount, n: 1 });
    }
    return {
      income,
      expense,
      balance: income - expense,
      expenseRank: rankByRoot(expenses, catMap, expense),
      incomeRank: rankByRoot(incomes, catMap, income),
      places: [...byPlace.values()].sort((a, b) => b.total - a.total).slice(0, 5),
      recent: list.slice(0, 5),
      count: list.length
    };
  }, [txs, catMap]);

  const slices: Slice[] = useMemo(() => {
    const top = data.expenseRank.slice(0, 5).map((r, i) => ({ key: r.id, value: r.value, color: COLORS[i] }));
    const rest = data.expenseRank.slice(5).reduce((a, r) => a + r.value, 0);
    if (rest > 0) top.push({ key: '__rest__', value: rest, color: 'var(--c7)' });
    return top;
  }, [data.expenseRank]);

  const bal = moneyParts(data.balance);
  const maxPlace = data.places[0]?.total ?? 1;
  const dim = loading && txs === undefined ? 'loading-dim' : '';

  return (
    <div className="screen-inner">
      <Header eyebrow={greeting()} title="Resumen" onSettings={onSettings} />
      <MonthPicker month={month} onChange={setMonth} />

      {error && <p className="error-text">{error}</p>}

      <section className={`card glass balance ${dim}`}>
        <div className="k">Balance del mes</div>
        <div className={`big-number ${data.balance < 0 ? 'neg' : ''}`}>
          {bal.sign}
          {bal.int}
          <span className="dec">{bal.dec}</span>
        </div>
      </section>

      <div className={`stat-row ${dim}`}>
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
          <div style={{ marginTop: 20 }}>
            <RankList items={data.expenseRank} colorFor={(i) => (i < 5 ? COLORS[i] : 'var(--c7)')} />
          </div>
          {data.expenseRank.some((r) => r.children.length > 0) && (
            <p className="note" style={{ marginTop: 14 }}>
              Toca una categoría para ver sus subcategorías.
            </p>
          )}
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
          <RankList items={data.incomeRank} colorFor={() => 'var(--accent-ink)'} tone="income" />
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
              <TxRow key={t.id} tx={t} cats={catMap} onClick={() => onEdit(t)} showDate />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
