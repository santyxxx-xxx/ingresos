import { useState } from 'react';
import { Plus } from 'lucide-react';
import { InlineCreate } from './InlineCreate';
import { useFeedback } from './Feedback';
import { useData } from '../lib/data';
import { haptic } from '../lib/utils';

/** ¿De quién o para qué es el movimiento? Casa, Personal, Hijo… */
export function SectionPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { groups, saveGroup } = useData();
  const { toast } = useFeedback();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <span className="field-label">Sección</span>
      <div className="chips">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className="chip section"
            aria-pressed={value === g.id}
            onClick={() => {
              haptic(5);
              onChange(value === g.id ? null : g.id);
            }}
          >
            <span className="e">{g.emoji}</span>
            {g.name}
          </button>
        ))}
        {!creating && (
          <button type="button" className="chip add" onClick={() => setCreating(true)}>
            <Plus size={15} strokeWidth={2} />
            Nueva
          </button>
        )}
      </div>
      {creating && (
        <InlineCreate
          placeholder="Ej. Hijo, Esposa, Negocio"
          defaultEmoji="👤"
          onCancel={() => setCreating(false)}
          onCreate={async (name, emoji) => {
            const id = await saveGroup({ name, emoji });
            onChange(id);
            setCreating(false);
            haptic(12);
            toast(`Sección “${name}” creada`);
          }}
        />
      )}
    </div>
  );
}
