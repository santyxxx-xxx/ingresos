import { useData } from '../lib/data';

/** 'all' = total, 'none' = sin sección, o el id de una sección */
export function matchesSection(sectionId: string | null, filter: string) {
  if (filter === 'all') return true;
  if (filter === 'none') return !sectionId;
  return sectionId === filter;
}

export function SectionFilter({
  value,
  onChange,
  hasUnassigned
}: {
  value: string;
  onChange: (v: string) => void;
  hasUnassigned?: boolean;
}) {
  const { groups } = useData();
  if (groups.length === 0) return null;
  return (
    <div className="group-filter no-select" role="tablist" aria-label="Ver por sección">
      <button role="tab" aria-selected={value === 'all'} onClick={() => onChange('all')}>
        Total
      </button>
      {groups.map((g) => (
        <button key={g.id} role="tab" aria-selected={value === g.id} onClick={() => onChange(g.id)}>
          <span className="e">{g.emoji}</span> {g.name}
        </button>
      ))}
      {hasUnassigned && (
        <button role="tab" aria-selected={value === 'none'} onClick={() => onChange('none')}>
          Sin sección
        </button>
      )}
    </div>
  );
}
