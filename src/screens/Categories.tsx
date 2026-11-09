import { useEffect, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { Header } from '../components/Header';
import { Segmented } from '../components/Segmented';
import { UNCATEGORIZED, childrenOf, fetchCategoryUsage, fetchUncategorizedCount, topLevel, useData } from '../lib/data';
import type { Category, TxType } from '../lib/types';

interface Props {
  onEdit: (c: Category) => void;
  onNew: (type: TxType, parent: Category | null) => void;
  onSettings: () => void;
}

export function Categories({ onEdit, onNew, onSettings }: Props) {
  const [type, setType] = useState<TxType>('expense');
  const { uid, categories, catsLoaded, catsError, txVersion } = useData();
  const [usage, setUsage] = useState<Map<string, number>>(new Map());
  const [none, setNone] = useState(0);

  useEffect(() => {
    fetchCategoryUsage(uid).then(setUsage);
  }, [uid, txVersion, categories]);
  useEffect(() => {
    fetchUncategorizedCount(uid, type).then(setNone);
  }, [uid, type, txVersion, categories]);

  const roots = topLevel(categories, type);
  const label = (n: number) => `${n} movimiento${n === 1 ? '' : 's'}`;

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

      {catsError && <p className="error-text">{catsError}</p>}

      {roots.map((c) => {
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
      })}

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

      {catsLoaded && roots.length === 0 && (
        <section className="card glass empty">
          <div className="art">🏷️</div>
          <p>No tienes categorías de {type === 'income' ? 'ingreso' : 'gasto'}.</p>
        </section>
      )}

      <button className="btn btn-primary" onClick={() => onNew(type, null)}>
        <Plus size={20} strokeWidth={2} />
        Nueva categoría
      </button>
      <p className="note" style={{ textAlign: 'center' }}>
        Toca una categoría o subcategoría para cambiar su nombre o emoji, o para borrarla. Si borras una categoría, sus
        movimientos pasan a “Sin categoría”; si borras una subcategoría, pasan a su categoría principal.
      </p>
    </div>
  );
}
