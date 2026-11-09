import { useEffect, useState } from 'react';
import { ChevronRight, Pencil, Plus } from 'lucide-react';
import { Header } from '../components/Header';
import { Segmented } from '../components/Segmented';
import {
  UNCATEGORIZED,
  byGroup,
  childrenOf,
  fetchCategoryUsage,
  fetchUncategorizedCount,
  topLevel,
  useData
} from '../lib/data';
import type { Category, Group, TxType } from '../lib/types';
import { money } from '../lib/utils';

interface Props {
  onEdit: (c: Category) => void;
  onNew: (type: TxType, parent: Category | null) => void;
  onEditGroup: (g: Group | null) => void;
  onSettings: () => void;
}

export function Categories({ onEdit, onNew, onEditGroup, onSettings }: Props) {
  const [type, setType] = useState<TxType>('expense');
  const { uid, categories, groups, loaded, loadError, txVersion } = useData();
  const [usage, setUsage] = useState<Map<string, number>>(new Map());
  const [none, setNone] = useState(0);

  useEffect(() => {
    fetchCategoryUsage(uid).then(setUsage);
  }, [uid, txVersion, categories]);
  useEffect(() => {
    fetchUncategorizedCount(uid, type).then(setNone);
  }, [uid, type, txVersion, categories]);

  const roots = topLevel(categories, type);
  const sections = byGroup(roots, groups);
  const emptyGroups = groups.filter((g) => !sections.some((s) => s.group?.id === g.id));
  const label = (n: number) => `${n} movimiento${n === 1 ? '' : 's'}`;

  const renderCategory = (c: Category) => {
    const subs = childrenOf(categories, c.id);
    const total = (usage.get(c.id) ?? 0) + subs.reduce((a, s) => a + (usage.get(s.id) ?? 0), 0);
    return (
      <section className="list-card glass" key={c.id}>
        <button className="list-row pressable" onClick={() => onEdit(c)}>
          <span className="badge">{c.emoji}</span>
          <span className="info">
            <span className="title">{c.name}</span>
            <span className="meta">
              {label(total)}
              {subs.length > 0 && ` · ${subs.length} subcategoría${subs.length === 1 ? '' : 's'}`}
              {c.budget ? ` · presupuesto ${money(c.budget)}` : ''}
            </span>
          </span>
          <ChevronRight className="chev" size={18} strokeWidth={1.75} />
        </button>
        {subs.map((s) => (
          <button key={s.id} className="list-row sub pressable" onClick={() => onEdit(s)}>
            <span className="badge small">{s.emoji}</span>
            <span className="info">
              <span className="title">{s.name}</span>
              <span className="meta">{label(usage.get(s.id) ?? 0)}</span>
            </span>
            <ChevronRight className="chev" size={16} strokeWidth={1.75} />
          </button>
        ))}
        <button className="list-row sub add pressable" onClick={() => onNew(type, c)}>
          <span className="badge small">
            <Plus size={16} strokeWidth={2} />
          </span>
          <span className="info">
            <span className="title">Agregar subcategoría</span>
          </span>
        </button>
      </section>
    );
  };

  return (
    <div className="screen-inner">
      <Header title="Categorías" onSettings={onSettings} />
      <Segmented
        value={type}
        onChange={setType}
        tone={type}
        options={[
          { value: 'expense', label: 'Gastos' },
          { value: 'income', label: 'Ingresos' }
        ]}
      />

      {loadError && <p className="error-text">{loadError}</p>}

      {sections.map((sec) => (
        <div className="group-block" key={sec.group?.id ?? 'none'}>
          <div className="group-head">
            <h3>
              {sec.group ? (
                <>
                  <span className="e">{sec.group.emoji}</span> {sec.group.name}
                </>
              ) : (
                'Sin grupo'
              )}
            </h3>
            {sec.group && (
              <button className="icon-btn" onClick={() => onEditGroup(sec.group)} aria-label={`Editar ${sec.group.name}`}>
                <Pencil size={16} strokeWidth={1.75} />
              </button>
            )}
          </div>
          {sec.items.map(renderCategory)}
        </div>
      ))}

      {emptyGroups.length > 0 && (
        <div className="chips">
          {emptyGroups.map((g) => (
            <button key={g.id} className="chip small" onClick={() => onEditGroup(g)}>
              <span className="e">{g.emoji}</span>
              {g.name} · vacío
            </button>
          ))}
        </div>
      )}

      {none > 0 && (
        <section className="list-card glass">
          <div className="list-row">
            <span className="badge">{UNCATEGORIZED.emoji}</span>
            <span className="info">
              <span className="title">{UNCATEGORIZED.name}</span>
              <span className="meta">{label(none)} · edítalos para asignarles una categoría</span>
            </span>
          </div>
        </section>
      )}

      {loaded && roots.length === 0 && (
        <section className="card glass empty">
          <div className="art">🏷️</div>
          <p>No tienes categorías de {type === 'income' ? 'ingreso' : 'gasto'}.</p>
        </section>
      )}

      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => onNew(type, null)}>
          <Plus size={20} strokeWidth={2} />
          Categoría
        </button>
        <button className="btn btn-ghost" onClick={() => onEditGroup(null)}>
          <Plus size={20} strokeWidth={2} />
          Grupo
        </button>
      </div>
      <p className="note" style={{ textAlign: 'center' }}>
        Toca una categoría para cambiar su nombre, emoji, grupo o presupuesto. Si borras una categoría, sus movimientos
        pasan a “Sin categoría”; si borras una subcategoría, pasan a su categoría principal.
      </p>
    </div>
  );
}
