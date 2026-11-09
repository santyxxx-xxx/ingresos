import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Sheet } from './Sheet';
import { useFeedback } from './Feedback';
import { useData } from '../lib/data';
import type { Group } from '../lib/types';
import { haptic } from '../lib/utils';

const EMOJIS = ['🏠', '🙋', '👦', '👧', '👩', '👨', '👵', '👴', '👶', '❤️', '💼', '🐶', '🚗', '🎓', '✈️', '🌱'];

export function GroupSheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Group | null }) {
  const { saveGroup, deleteGroup } = useData();
  const { confirm, toast } = useFeedback();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    setName(editing?.name ?? '');
    setEmoji(editing?.emoji ?? '💼');
  }, [open, editing]);

  const submit = async () => {
    const n = name.trim();
    if (!n) return setError('Escribe un nombre');
    setSaving(true);
    try {
      await saveGroup({ id: editing?.id, name: n, emoji: emoji.trim() || '📁' });
      haptic(15);
      toast(editing ? 'Sección actualizada' : 'Sección creada');
      onClose();
    } catch (e) {
      setSaving(false);
      setError((e as Error).message);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: `Borrar “${editing.name}”`,
      message: 'Sus movimientos no se borran: quedan “Sin sección” y los puedes cambiar a otra cuando quieras.',
      confirmLabel: 'Borrar sección',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteGroup(editing);
      toast('Sección borrada');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Editar sección' : 'Nueva sección'}>
      <p className="note" style={{ marginTop: -6 }}>
        Las secciones dicen a quién o a qué pertenece cada movimiento: <b>Casa</b>, <b>Personal</b>, <b>Hijo</b>,{' '}
        <b>Esposa</b>, <b>Negocio</b>… En el resumen puedes ver cada una por separado o el total.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ width: 76 }}>
          <label className="field-label" htmlFor="grp-emoji">
            Emoji
          </label>
          <input
            id="grp-emoji"
            className="input"
            style={{ textAlign: 'center', fontSize: 24, padding: 0 }}
            value={emoji}
            onChange={(e) => setEmoji([...e.target.value].slice(-2).join(''))}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="grp-name">
            Nombre
          </label>
          <input
            id="grp-name"
            className="input"
            placeholder="Ej. Hijo, Esposa, Negocio"
            value={name}
            maxLength={40}
            onChange={(e) => {
              setError('');
              setName(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
      </div>
      <div className="emoji-grid">
        {EMOJIS.map((e) => (
          <button key={e} type="button" aria-pressed={emoji === e} onClick={() => setEmoji(e)}>
            {e}
          </button>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-primary" onClick={submit} disabled={saving}>
        <Check size={20} strokeWidth={2} />
        {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear sección'}
      </button>
      {editing && (
        <button className="btn btn-danger" onClick={remove}>
          <Trash2 size={18} strokeWidth={1.75} />
          Borrar sección
        </button>
      )}
    </Sheet>
  );
}
