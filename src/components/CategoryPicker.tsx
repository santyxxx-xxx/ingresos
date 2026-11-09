import { useMemo } from 'react';
import { byGroup, childrenOf, topLevel, useData } from '../lib/data';
import type { TxType } from '../lib/types';
import { haptic } from '../lib/utils';

/** Selector de categoría → subcategoría, agrupado por grupo */
export function CategoryPicker({
  type,
  value,
  onChange
}: {
  type: TxType;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { categories, catMap, groups } = useData();
  const roots = useMemo(() => topLevel(categories, type), [categories, type]);
  const sections = useMemo(() => byGroup(roots, groups), [roots, groups]);
  const selected = value ? catMap.get(value) : undefined;
  const rootId = selected ? selected.parentId ?? selected.id : null;
  const subs = rootId ? childrenOf(categories, rootId) : [];

  return (
    <>
      <div>
        <span className="field-label">Categoría</span>
        {sections.map((sec) => (
          <div className="chip-section" key={sec.group?.id ?? 'none'}>
            {sections.length > 1 && (
              <div className="chip-section-title">{sec.group ? `${sec.group.emoji} ${sec.group.name}` : 'Otras'}</div>
            )}
            <div className="chips">
              {sec.items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${type}`}
                  aria-pressed={rootId === c.id}
                  onClick={() => {
                    haptic(5);
                    onChange(c.id);
                  }}
                >
                  <span className="e">{c.emoji}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {subs.length > 0 && rootId && (
        <div className="sub-picker">
          <span className="field-label">Subcategoría</span>
          <div className="chips">
            <button type="button" className="chip small" aria-pressed={value === rootId} onClick={() => onChange(rootId)}>
              General
            </button>
            {subs.map((s) => (
              <button key={s.id} type="button" className="chip small" aria-pressed={value === s.id} onClick={() => onChange(s.id)}>
                <span className="e">{s.emoji}</span>
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
