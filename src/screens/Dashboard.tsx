import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Plus, Target } from 'lucide-react';
import { Header } from '../components/Header';
import { MonthPicker } from '../components/MonthPicker';
import { Donut, type Slice } from '../components/Donut';
import { TxRow } from '../components/TxRow';
import { useAccount } from '../lib/account';
import { UNCATEGORIZED, catInfo, isTransfer, rootOf, transferMap, useData, useTxRange } from '../lib/data';
import { SectionFilter, matchesSection } from '../components/SectionFilter';
import type { Category, Transaction } from '../lib/types';
import {
  WEEKDAYS,
  currentMonth,
  money,
  moneyParts,
  monthLabel,
  normalizePlace,
  shiftMonth,
  todayISO,
  weekdayDatesInMonth
} from '../lib/utils';

interface Props {
  month: string;
  setMonth: (m: string) => void;
  onEdit: (t: Transaction) => void;
  onAdd: () => void;
  onSeeAll: () => void;
  onSettings: () => void;
  onGoCategories: () => void;
}

const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
const NONE = '__none__';
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const sum = (list: Transaction[]) => list.reduce((a, t) => a + t.amount, 0);
const monthName = (m: string) => monthLabel(m).split(' ')[0].toLowerCase();
const daysIn = (m: string) => {
  const [y, mm] = m.split('-').map(Number);
  return new Date(y, mm, 0).getDate();
};

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

/** Variación porcentual con color según si es bueno o malo */
function Delta({ now, before, goodWhenUp, label }: { now: number; before: number; goodWhenUp: boolean; label: string }) {
  if (!before && !now) return null;
  if (!before) return <span className="delta neutral">Nuevo vs {label}</span>;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.5) return <span className="delta neutral">Igual que {label}</span>;
  const up = pct > 0;
  const good = up === goodWhenUp;
  return (
    <span className={`delta ${good ? 'good' : 'bad'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}% vs {label}
    </span>
  );
}

function MonthsChart({
  months,
  selected,
  onPick
}: {
  months: Array<{ month: string; income: number; expense: number }>;
  selected: string;
  onPick: (m: string) => void;
}) {
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const W = 320;
  const H = 130;
  const top = 8;
  const bottom = 22;
  const slot = W / months.length;
  const bw = Math.min(14, slot / 3.2);
  const h = (v: number) => (v / max) * (H - top - bottom);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="months-chart" role="img" aria-label="Ingresos y gastos de los últimos 6 meses">
      <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} style={{ stroke: 'var(--hair)' }} />
      {months.map((m, i) => {
        const cx = slot * i + slot / 2;
        const isSel = m.month === selected;
        const label = MONTHS_SHORT[Number(m.month.slice(5, 7)) - 1];
        return (
          <g key={m.month} onClick={() => onPick(m.month)} style={{ cursor: 'pointer' }} opacity={isSel ? 1 : 0.55}>
            <rect x={cx - slot / 2} y={0} width={slot} height={H} fill="transparent" />
            <rect
              x={cx - bw - 1.5}
              y={H - bottom - h(m.income)}
              width={bw}
              height={Math.max(h(m.income), m.income ? 2 : 0)}
              rx={4}
              style={{ fill: 'var(--accent)' }}
            />
            <rect
              x={cx + 1.5}
              y={H - bottom - h(m.expense)}
              width={bw}
              height={Math.max(h(m.expense), m.expense ? 2 : 0)}
              rx={4}
              style={{ fill: 'var(--expense)' }}
            />
            <text
              x={cx}
              y={H - 6}
              textAnchor="middle"
              style={{ fill: isSel ? 'var(--ink)' : 'var(--ink-3)', fontSize: 11, fontWeight: isSel ? 650 : 500 }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Dashboard({ month, setMonth, onEdit, onAdd, onSeeAll, onSettings, onGoCategories }: Props) {
  const account = useAccount();
  const { catMap, categories, groups, groupMap, recurring } = useData();
  const from = shiftMonth(month, -5);
  const { data: range, error, loading } = useTxRange(from, month);
  const [group, setGroup] = useState<string>('all');

  const prevMonth = shiftMonth(month, -1);
  const isCurrent = month === currentMonth();

  const d = useMemo(() => {
    const all = range ?? [];
    // Las transferencias no son gasto ni ingreso: se cuentan aparte
    const inView = all.filter((t) => matchesSection(t.sectionId, group));
    const filtered = inView.filter((t) => !isTransfer(t));
    const curTransfers = inView.filter((t) => isTransfer(t) && t.date.startsWith(month));
    const transfersIn = group === 'all' ? 0 : sum(curTransfers.filter((t) => t.type === 'income'));
    const transfersOut = group === 'all' ? 0 : sum(curTransfers.filter((t) => t.type === 'expense'));
    const cur = filtered.filter((t) => t.date.startsWith(month));
    const prev = filtered.filter((t) => t.date.startsWith(prevMonth));
    const exp = cur.filter((t) => t.type === 'expense');
    const inc = cur.filter((t) => t.type === 'income');
    const prevExp = prev.filter((t) => t.type === 'expense');
    const prevInc = prev.filter((t) => t.type === 'income');
    const expense = sum(exp);
    const income = sum(inc);

    // Lugares
    const byPlace = new Map<string, { label: string; total: number; n: number }>();
    for (const t of exp) {
      if (!t.place.trim()) continue;
      const k = normalizePlace(t.place);
      const p = byPlace.get(k);
      if (p) {
        p.total += t.amount;
        p.n++;
      } else byPlace.set(k, { label: t.place.trim(), total: t.amount, n: 1 });
    }

    // Promedios y proyección
    const today = todayISO();
    const daysElapsed = isCurrent ? Number(today.slice(8, 10)) : daysIn(month);
    const avgDaily = daysElapsed ? expense / daysElapsed : 0;
    const projection = isCurrent ? Math.round(avgDaily * daysIn(month)) : expense;
    const biggest = exp.reduce<Transaction | null>((a, t) => (!a || t.amount > a.amount ? t : a), null);

    // 6 meses
    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(from, i)).map((m) => {
      const list = filtered.filter((t) => t.date.startsWith(m));
      return {
        month: m,
        income: sum(list.filter((t) => t.type === 'income')),
        expense: sum(list.filter((t) => t.type === 'expense'))
      };
    });
    const withData = months.filter((m) => m.expense > 0);
    const avgExpense6 = withData.length ? withData.reduce((a, m) => a + m.expense, 0) / withData.length : 0;

    // Cambios por categoría vs mes anterior
    const byRoot = (list: Transaction[]) => {
      const m = new Map<string, number>();
      for (const t of list) {
        const id = rootOf(catMap, t.categoryId)?.id ?? NONE;
        m.set(id, (m.get(id) ?? 0) + t.amount);
      }
      return m;
    };
    const nowMap = byRoot(exp);
    const beforeMap = byRoot(prevExp);
    const changes = [...new Set([...nowMap.keys(), ...beforeMap.keys()])]
      .map((id) => {
        const now = nowMap.get(id) ?? 0;
        const before = beforeMap.get(id) ?? 0;
        const c = id === NONE ? undefined : catMap.get(id);
        return {
          id,
          name: c?.name ?? UNCATEGORIZED.name,
          emoji: c?.emoji ?? UNCATEGORIZED.emoji,
          now,
          before,
          diff: now - before
        };
      })
      .filter((x) => x.diff !== 0)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 4);

    // Presupuestos (categorías principales de gasto con presupuesto)
    const budgets = categories
      .filter((c) => !c.parentId && c.type === 'expense' && c.budget && group === 'all')
      .map((c) => {
        const spent = nowMap.get(c.id) ?? 0;
        return { cat: c, spent, budget: c.budget!, pct: (spent / c.budget!) * 100 };
      })
      .sort((a, b) => b.pct - a.pct);

    // Por sección (para la vista Total)
    const monthAll = all.filter((t) => t.date.startsWith(month));
    const sectionIds = [...groups.map((g) => g.id as string | null)];
    if (monthAll.some((t) => !t.sectionId)) sectionIds.push(null);
    const bySection = sectionIds
      .map((sid) => {
        const list = monthAll.filter((t) => (t.sectionId ?? null) === sid);
        const real = list.filter((t) => !isTransfer(t));
        const trf = list.filter((t) => isTransfer(t));
        const inc = sum(real.filter((t) => t.type === 'income'));
        const ex = sum(real.filter((t) => t.type === 'expense'));
        const tIn = sum(trf.filter((t) => t.type === 'income'));
        const tOut = sum(trf.filter((t) => t.type === 'expense'));
        return { sid, income: inc, expense: ex, tIn, tOut, balance: inc - ex + tIn - tOut, count: list.length };
      })
      .filter((s) => s.sid !== null || s.count > 0);

    const tmap = transferMap(monthAll);
    const recentList = (group === 'all' ? inView.filter((t) => !t.id.endsWith('-in')) : inView)
      .filter((t) => t.date.startsWith(month))
      .slice(0, 5);

    return {
      income,
      expense,
      balance: income - expense + transfersIn - transfersOut,
      transfersIn,
      transfersOut,
      bySection,
      tmap,
      recentList,
      prevIncome: sum(prevInc),
      prevExpense: sum(prevExp),
      expenseRank: rankByRoot(exp, catMap, expense),
      incomeRank: rankByRoot(inc, catMap, income),
      places: [...byPlace.values()].sort((a, b) => b.total - a.total).slice(0, 5),
      recent: cur.slice(0, 5),
      count: cur.length,
      avgDaily,
      projection,
      biggest,
      months,
      avgExpense6,
      changes,
      budgets
    };
  }, [range, group, catMap, categories, groups, month, prevMonth, from, isCurrent]);

  // Fijos del mes (solo mes actual)
  const fixed = useMemo(() => {
    if (!isCurrent) return [];
    const today = Number(todayISO().slice(8, 10));
    const dim = daysIn(month);
    return recurring
      .filter((r) => r.active && matchesSection(r.sectionId, group))
      .map((r) => {
        if (r.frequency === 'weekly' && r.dayOfWeek) {
          const dates = weekdayDatesInMonth(month, r.dayOfWeek, r.startDate);
          const doneCount = dates.filter((x) => x <= todayISO()).length;
          return {
            r,
            day: dates.length ? Number(dates[0].slice(8, 10)) : 99,
            done: dates.length > 0 && doneCount === dates.length,
            times: dates.length,
            doneCount
          };
        }
        const day = Math.min(r.dayOfMonth, dim);
        const done = day <= today && r.startDate <= todayISO();
        return { r, day, done, times: 1, doneCount: done ? 1 : 0 };
      })
      .filter((f) => f.times > 0)
      .sort((a, b) => a.day - b.day);
  }, [recurring, isCurrent, month, group]);

  const slices: Slice[] = useMemo(() => {
    const top = d.expenseRank.slice(0, 5).map((r, i) => ({ key: r.id, value: r.value, color: COLORS[i] }));
    const rest = d.expenseRank.slice(5).reduce((a, r) => a + r.value, 0);
    if (rest > 0) top.push({ key: '__rest__', value: rest, color: 'var(--c7)' });
    return top;
  }, [d.expenseRank]);

  const bal = moneyParts(d.balance);
  const maxPlace = d.places[0]?.total ?? 1;
  const dim = loading && range === undefined ? 'loading-dim' : '';
  const prevLabel = monthName(prevMonth);
  const hasBudgets = categories.some((c) => c.budget);
  const budgetTotal = d.budgets.reduce((a, b) => a + b.budget, 0);
  const budgetSpent = d.budgets.reduce((a, b) => a + b.spent, 0);
  const pendingFixed = fixed.filter((f) => !f.done);
  const sectionName = (sid: string | null) => (sid ? groupMap.get(sid) : undefined);

  return (
    <div className="screen-inner">
      <Header
        eyebrow={greeting()}
        title={
          <>
            Bienvenido{account.name ? ', ' : ''}
            {account.name && <em>{account.name}</em>}
          </>
        }
        onSettings={onSettings}
      />
      <MonthPicker month={month} onChange={setMonth} />

      <SectionFilter value={group} onChange={setGroup} hasUnassigned={(range ?? []).some((t) => !t.sectionId)} />

      {error && <p className="error-text">{error}</p>}

      <section className={`card glass balance ${dim}`}>
        <div className="k">
          {group === 'all'
            ? groups.length
              ? 'Balance total del mes'
              : 'Balance del mes'
            : group === 'none'
              ? 'Balance sin sección'
              : `Balance de ${groupMap.get(group)?.name ?? ''}`}
        </div>
        <div className={`big-number ${d.balance < 0 ? 'neg' : ''}`}>
          {bal.sign}
          {bal.int}
          <span className="dec">{bal.dec}</span>
        </div>
        <p className="balance-note">
          {d.count === 0
            ? 'Aún no hay movimientos este mes.'
            : d.balance >= 0
              ? `Te queda el ${d.income ? Math.round((d.balance / d.income) * 100) : 0}% de lo que entró.`
              : 'Este mes estás gastando más de lo que entra.'}
        </p>
        {(d.transfersIn > 0 || d.transfersOut > 0) && (
          <p className="balance-note transfer-note">
            ↔️ Transferencias:
            {d.transfersIn > 0 && <span className="c-income"> recibiste {money(d.transfersIn)}</span>}
            {d.transfersIn > 0 && d.transfersOut > 0 && ' ·'}
            {d.transfersOut > 0 && <span> enviaste {money(d.transfersOut)}</span>}
          </p>
        )}
      </section>

      <div className={`stat-row ${dim}`}>
        <div className="stat glass income">
          <div className="top">
            <span className="dot">
              <ArrowDownRight size={16} strokeWidth={2} />
            </span>
            Ingresos
          </div>
          <div className="val">{money(d.income)}</div>
          <Delta now={d.income} before={d.prevIncome} goodWhenUp label={prevLabel} />
        </div>
        <div className="stat glass expense">
          <div className="top">
            <span className="dot">
              <ArrowUpRight size={16} strokeWidth={2} />
            </span>
            Gastos
          </div>
          <div className="val">{money(d.expense)}</div>
          <Delta now={d.expense} before={d.prevExpense} goodWhenUp={false} label={prevLabel} />
        </div>
      </div>

      {group === 'all' && d.bySection.length >= 2 && (
        <section className="card glass">
          <div className="card-title">
            <h2>Por sección</h2>
            <span className="card-aside">Toca para ver el detalle</span>
          </div>
          <div className="section-list">
            {d.bySection.map((s) => {
              const g = sectionName(s.sid);
              return (
                <button
                  key={s.sid ?? 'none'}
                  className="section-row pressable"
                  onClick={() => setGroup(s.sid ?? 'none')}
                >
                  <span className="badge">{g?.emoji ?? '📂'}</span>
                  <span className="info">
                    <span className="title">{g?.name ?? 'Sin sección'}</span>
                    <span className="meta">
                      Entra <b className="c-income">{money(s.income + s.tIn)}</b> · Sale{' '}
                      <b className="c-expense">{money(s.expense + s.tOut)}</b>
                      {(s.tIn > 0 || s.tOut > 0) && ' · incluye transferencias'}
                    </span>
                  </span>
                  <span className={`section-bal display ${s.balance < 0 ? 'c-expense' : ''}`}>
                    {s.balance < 0 ? '−' : ''}
                    {money(Math.abs(s.balance))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {range !== undefined && d.count === 0 && (
        <section className="card glass empty">
          <div className="art">🌿</div>
          <h3>Sin movimientos este mes</h3>
          <p>Registra tu primer gasto o ingreso con el botón +.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onAdd}>
            <Plus size={20} strokeWidth={2} /> Agregar movimiento
          </button>
        </section>
      )}

      {d.expense > 0 && (
        <div className={`insights ${dim}`}>
          <div className="insight glass">
            <small>Promedio diario</small>
            <b className="display">{money(Math.round(d.avgDaily))}</b>
          </div>
          <div className="insight glass">
            <small>{isCurrent ? 'Proyección del mes' : 'Promedio 6 meses'}</small>
            <b className="display">{money(isCurrent ? d.projection : Math.round(d.avgExpense6))}</b>
          </div>
          {d.biggest && (
            <button className="insight glass pressable" onClick={() => onEdit(d.biggest!)}>
              <small>Mayor gasto</small>
              <b className="display">{money(d.biggest.amount)}</b>
              <span>{d.biggest.place || catInfo(catMap, d.biggest.categoryId).name}</span>
            </button>
          )}
        </div>
      )}

      {d.budgets.length > 0 ? (
        <section className="card glass">
          <div className="card-title">
            <h2>Presupuestos</h2>
            <span className="card-aside">
              {money(budgetSpent)} de {money(budgetTotal)}
            </span>
          </div>
          <div className="budget-list">
            {d.budgets.map((b) => {
              const state = b.pct >= 100 ? 'over' : b.pct >= 80 ? 'warn' : 'ok';
              const left = b.budget - b.spent;
              return (
                <div className={`budget ${state}`} key={b.cat.id}>
                  <div className="budget-top">
                    <span className="badge small">{b.cat.emoji}</span>
                    <span className="name">{b.cat.name}</span>
                    <span className="amt">
                      {money(b.spent)} <small>/ {money(b.budget)}</small>
                    </span>
                  </div>
                  <div className="budget-bar">
                    <span style={{ width: `${Math.min(100, b.pct)}%` }} />
                  </div>
                  <div className="budget-foot">
                    {left >= 0 ? `Te quedan ${money(left)}` : `Te pasaste por ${money(-left)}`}
                    <span>{Math.round(b.pct)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : group !== 'all' && hasBudgets ? (
        <p className="note" style={{ textAlign: 'center' }}>
          Los presupuestos se ven en la vista Total.
        </p>
      ) : (
        !hasBudgets &&
        d.expense > 0 && (
          <button className="hint-card glass pressable" onClick={onGoCategories}>
            <span className="badge ok">
              <Target size={18} strokeWidth={1.75} />
            </span>
            <span>
              <b>Ponle un límite a tus gastos.</b> Define un presupuesto mensual en tus categorías y aquí verás cuánto
              te queda.
            </span>
          </button>
        )
      )}

      {d.expenseRank.length > 0 && (
        <section className="card glass">
          <div className="card-title">
            <h2>Dónde gasto más</h2>
          </div>
          <div className="donut-wrap">
            <Donut slices={slices} center={money(d.expense)} sub="gastado" />
            <div className="legend">
              {slices.map((s) => {
                const r = d.expenseRank.find((x) => x.id === s.key);
                const name = r ? `${r.emoji} ${r.name}` : 'Resto';
                const pct = d.expense ? (s.value / d.expense) * 100 : 0;
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
            <RankList items={d.expenseRank} colorFor={(i) => (i < 5 ? COLORS[i] : 'var(--c7)')} />
          </div>
          {d.expenseRank.some((r) => r.children.length > 0) && (
            <p className="note" style={{ marginTop: 14 }}>
              Toca una categoría para ver sus subcategorías.
            </p>
          )}
        </section>
      )}

      {d.months.some((m) => m.income || m.expense) && (
        <section className="card glass">
          <div className="card-title">
            <h2>Mes a mes</h2>
            <span className="legend-inline">
              <i style={{ background: 'var(--accent)' }} /> Ingresos <i style={{ background: 'var(--expense)' }} /> Gastos
            </span>
          </div>
          <MonthsChart months={d.months} selected={month} onPick={setMonth} />
          {d.changes.length > 0 && (
            <>
              <div className="subhead">Cambios vs {prevLabel}</div>
              <div className="change-list">
                {d.changes.map((c) => (
                  <div className="change" key={c.id}>
                    <span className="badge small">{c.emoji}</span>
                    <span className="name">{c.name}</span>
                    <span className="vals">
                      <span className={`delta ${c.diff > 0 ? 'bad' : 'good'}`}>
                        {c.diff > 0 ? '↑' : '↓'} {money(Math.abs(c.diff))}
                      </span>
                      <small>
                        {money(c.before)} → {money(c.now)}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {fixed.length > 0 && (
        <section className="card glass">
          <div className="card-title">
            <h2>Fijos del mes</h2>
            <span className="card-aside">
              {pendingFixed.length ? `${pendingFixed.length} por venir` : 'Todos registrados'}
            </span>
          </div>
          <div className="fixed-list">
            {fixed.map(({ r, day, done, times, doneCount }) => {
              const c = catInfo(catMap, r.categoryId);
              const weekly = r.frequency === 'weekly' && r.dayOfWeek;
              return (
                <div className={`fixed ${done ? 'done' : ''}`} key={r.id}>
                  <span className="day">
                    {weekly ? (
                      <>
                        <b>{times}×</b>
                        <small>{WEEKDAYS[r.dayOfWeek!].slice(0, 3)}</small>
                      </>
                    ) : (
                      <>
                        <b>{day}</b>
                        <small>{MONTHS_SHORT[Number(month.slice(5, 7)) - 1]}</small>
                      </>
                    )}
                  </span>
                  <span className="info">
                    <span className="title">{r.place || c.name}</span>
                    <span className="meta">
                      {weekly
                        ? `Cada ${WEEKDAYS[r.dayOfWeek!]} · ${doneCount} de ${times} registrados`
                        : `${done ? 'Registrado' : 'Pendiente'} · ${c.name}`}
                    </span>
                  </span>
                  <span className={`amount ${r.type === 'income' ? 'c-income' : ''}`}>
                    {r.type === 'income' ? '+' : '−'}
                    {money(r.amount * times)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {d.places.length > 0 && (
        <section className="card glass">
          <div className="card-title">
            <h2>Dónde compro más</h2>
          </div>
          <div className="rank-list">
            {d.places.map((p, i) => (
              <div className="rank" key={p.label}>
                <span className="badge num">{i + 1}</span>
                <span className="name">{p.label}</span>
                <span className="amt">{money(p.total)}</span>
                <div className="bar">
                  <span style={{ width: `${(p.total / maxPlace) * 100}%`, background: 'var(--c5)', opacity: 0.85 - i * 0.12 }} />
                </div>
                <span className="sub">
                  {p.n} {p.n === 1 ? 'vez' : 'veces'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {d.incomeRank.length > 0 && (
        <section className="card glass">
          <div className="card-title">
            <h2>De dónde entra</h2>
          </div>
          <RankList items={d.incomeRank} colorFor={() => 'var(--accent)'} tone="income" />
        </section>
      )}

      {d.recentList.length > 0 && (
        <section className="card glass" style={{ paddingBottom: 8 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>
            <h2>Últimos movimientos</h2>
            <button className="link" onClick={onSeeAll}>
              Ver todos
            </button>
          </div>
          <div className="tx-list">
            {d.recentList.map((t) => (
              <TxRow
                key={t.id}
                tx={t}
                cats={catMap}
                onClick={() => onEdit(t)}
                showDate
                transfer={isTransfer(t) ? d.tmap.get(t.id.replace(/-(out|in)$/, '')) : undefined}
                totalView={group === 'all'}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
