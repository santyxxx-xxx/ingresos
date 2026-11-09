import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Plus } from 'lucide-react';
import { Header } from '../components/Header';
import { Segmented } from '../components/Segmented';
import { db } from '../lib/db';
import { UNCATEGORIZED, useCategories } from '../lib/hooks';
import type { Category, TxType } from '../lib/types';

interface Props {
  onEdit: (c: Category) => void;
  onNew: (type: TxType) => void;
  onSettings: () => void;
}

export function Categories({ onEdit, onNew, onSettings }: Props) {
  const [type, setType] = useState<TxType>('expense');
  const { list } = useCategories();

  const counts = useLiveQuery(async () => {
    const m = new Map<string, number>();
    let none = 0;
    await db.transactions.where('type').equals(type).each((t) => {
      if (t.deleted) return;
      if (t.categoryId) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1);
      else none++;
    });
    return { m, none };
  }, [type]);

  const cats = list.filter((c) => c.type === type);
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

      <section className="list-card glass">
        {cats.map((c) => (
          <button key={c.id} className="list-row pressable" onClick={() => onEdit(c)}>
            <span className="badge">{c.emoji}</span>
            <span className="info">
              <span className="title">{c.name}</span>
              <span className="meta">{label(counts?.m.get(c.id) ?? 0)}</span>
            </span>
            <ChevronRight className="chev" size={18} strokeWidth={1.75} />
          </button>
        ))}
        {(counts?.none ?? 0) > 0 && (
          <div className="list-row">
            <span className="badge">{UNCATEGORIZED.emoji}</span>
            <span className="info">
              <span className="title">{UNCATEGORIZED.name}</span>
              <span className="meta">{label(counts!.none)} · edítalos para asignarles una categoría</span>
            </span>
          </div>
        )}
        {cats.length === 0 && (counts?.none ?? 0) === 0 && (
          <div className="empty">
            <div className="art">🏷️</div>
            <p>No tienes categorías de {type === 'income' ? 'ingreso' : 'gasto'}.</p>
          </div>
        )}
      </section>

      <button className="btn btn-primary" onClick={() => onNew(type)}>
        <Plus size={20} strokeWidth={2} />
        Nueva categoría
      </button>
      <p className="note" style={{ textAlign: 'center' }}>
        Toca una categoría para cambiar su nombre o emoji, o para borrarla. Si borras una categoría con movimientos,
        estos pasan a “Sin categoría”.
      </p>
    </div>
  );
}
