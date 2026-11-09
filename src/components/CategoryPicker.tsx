import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { InlineCreate } from './InlineCreate';
import { useFeedback } from './Feedback';
import { childrenOf, topLevel, useData } from '../lib/data';
import type { TxType } from '../lib/types';
import { haptic } from '../lib/utils';

/** Selector de categoría → subcategoría, con opción de crear sin salir */
export function CategoryPicker({
  type,
  value,
  onChange,
  allowNone
}: {
  type: TxType;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Muestra la opción "Sin categoría" (al editar movimientos que no tienen) */
  allowNone?: boolean;
}) {
  const { categories, catMap, saveCategory } = useData();
  const { toast } = useFeedback();
  const [creating, setCreating] = useState<'cat' | 'sub' | null>(null);
  const roots = useMemo(() => topLevel(categories, type), [categories, type]);
  const selected = value ? catMap.get(value) : undefined;
  const rootId = selected ? selected.parentId ?? selected.id : null;
  const root = rootId ? catMap.get(rootId) : undefined;
  const subs = rootId ? childrenOf(categories, rootId) : [];

  return (
    <>
      <div>
        <span className="field-label">Categoría</span>
        <div className="chips">
          {roots.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${type}`}
              aria-pressed={rootId === c.id}
              onClick={() => {
                haptic(5);
                setCreating(null);
                onChange(c.id);
              }}
            >
              <span className="e">{c.emoji}</span>
              {c.name}
            </button>
          ))}
          {allowNone && (
            <button type="button" className={`chip ${type}`} aria-pressed={value === null} onClick={() => onChange(null)}>
              <span className="e">❔</span>Sin categoría
            </button>
          )}
          {creating !== 'cat' && (
            <button type="button" className="chip add" onClick={() => setCreating('cat')}>
              <Plus size={15} strokeWidth={2} />
              Nueva
            </button>
          )}
        </div>
        {creating === 'cat' && (
          <InlineCreate
            placeholder={type === 'income' ? 'Ej. Ventas, Arriendos' : 'Ej. Mascotas, Gimnasio'}
            defaultEmoji={type === 'income' ? '💰' : '🏷️'}
            onCancel={() => setCreating(null)}
            onCreate={async (name, emoji) => {
              const id = await saveCategory({ name, emoji, type, parentId: null });
              onChange(id);
              setCreating(null);
              haptic(12);
              toast(`Categoría “${name}” creada`);
            }}
          />
        )}
      </div>

      {root && (subs.length > 0 || creating === 'sub') && (
        <div className="sub-picker">
          <span className="field-label">Subcategoría de {root.name}</span>
          <div className="chips">
            <button type="button" className="chip small" aria-pressed={value === rootId} onClick={() => onChange(rootId)}>
              General
            </button>
            {subs.map((s) => (
              <button
                key={s.id}
                type="button"
                className="chip small"
                aria-pressed={value === s.id}
                onClick={() => {
                  haptic(5);
                  onChange(s.id);
                }}
              >
                <span className="e">{s.emoji}</span>
                {s.name}
              </button>
            ))}
            {creating !== 'sub' && (
              <button type="button" className="chip small add" onClick={() => setCreating('sub')}>
                <Plus size={14} strokeWidth={2} />
                Nueva
              </button>
            )}
          </div>
          {creating === 'sub' && (
            <InlineCreate
              placeholder="Ej. Supermercado, Restaurantes"
              defaultEmoji={root.emoji}
              onCancel={() => setCreating(null)}
              onCreate={async (name, emoji) => {
                const id = await saveCategory({ name, emoji, type, parentId: root.id });
                onChange(id);
                setCreating(null);
                haptic(12);
                toast(`Subcategoría “${name}” creada`);
              }}
            />
          )}
        </div>
      )}
      {root && subs.length === 0 && creating !== 'sub' && (
        <button type="button" className="text-link" onClick={() => setCreating('sub')}>
          <Plus size={14} strokeWidth={2} /> Agregar subcategoría a {root.name}
        </button>
      )}
    </>
  );
}
