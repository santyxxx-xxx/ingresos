import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Sheet } from './Sheet';
import { Segmented } from './Segmented';
import { useFeedback } from './Feedback';
import { db, deleteCategory, saveCategory } from '../lib/db';
import type { Category, TxType } from '../lib/types';
import { haptic } from '../lib/utils';

const EMOJIS: Record<TxType, string[]> = {
  expense: ['🍽️', '🛒', '☕', '🚕', '⛽', '🏠', '💡', '📱', '💊', '🏋️', '🎬', '🎮', '✈️', '📚', '👕', '🎁', '🐶', '💇', '🍻', '🧾', '🚗', '🛠️', '👶', '📦'],
  income: ['💼', '💻', '✨', '💰', '📈', '🏦', '🎁', '🧾', '🤝', '🏠', '🛍️', '🎓', '🪙', '💵', '🚀', '⭐']
};

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Category | null;
  defaultType: TxType;
}

export function CategorySheet({ open, onClose, editing, defaultType }: Props) {
  const { confirm, toast } = useFeedback();
  const [type, setType] = useState<TxType>(defaultType);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏷️');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setType(editing.type);
      setName(editing.name);
      setEmoji(editing.emoji);
    } else {
      setType(defaultType);
      setName('');
      setEmoji(EMOJIS[defaultType][0]);
    }
  }, [open, editing, defaultType]);

  const submit = async () => {
    const n = name.trim();
    if (!n) {
      setError('Escribe un nombre');
      haptic([20, 40, 20]);
      return;
    }
    const e = emoji.trim() || '🏷️';
    await saveCategory({ id: editing?.id, name: n, emoji: e, type });
    haptic(15);
    toast(editing ? 'Categoría actualizada' : 'Categoría creada');
    onClose();
  };

  const remove = async () => {
    if (!editing) return;
    const count = await db.transactions.where('categoryId').equals(editing.id).count();
    const ok = await confirm({
      title: `Borrar “${editing.name}”`,
      message:
        count > 0
          ? `Tiene ${count} movimiento${count === 1 ? '' : 's'}. No se perderán: pasarán a “Sin categoría”.`
          : 'Esta categoría no tiene movimientos. Se eliminará de forma permanente.',
      confirmLabel: 'Borrar categoría',
      danger: true
    });
    if (!ok) return;
    await deleteCategory(editing.id);
    haptic([10, 30, 10]);
    toast('Categoría borrada');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Editar categoría' : 'Nueva categoría'}>
      {!editing && (
        <Segmented
          value={type}
          tone={type}
          onChange={(t) => {
            setType(t);
            if (!EMOJIS[t].includes(emoji)) setEmoji(EMOJIS[t][0]);
          }}
          options={[
            { value: 'expense', label: 'Gasto' },
            { value: 'income', label: 'Ingreso' }
          ]}
        />
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ width: 76 }}>
          <label className="field-label" htmlFor="cat-emoji">
            Emoji
          </label>
          <input
            id="cat-emoji"
            className="input"
            style={{ textAlign: 'center', fontSize: 24, padding: 0 }}
            value={emoji}
            onChange={(e) => setEmoji([...e.target.value].slice(-2).join(''))}
            autoComplete="off"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="cat-name">
            Nombre
          </label>
          <input
            id="cat-name"
            className="input"
            placeholder="Ej. Mascotas"
            value={name}
            maxLength={28}
            autoCapitalize="sentences"
            enterKeyHint="done"
            onChange={(e) => {
              setError('');
              setName(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
      </div>

      <div className="emoji-grid">
        {EMOJIS[type].map((e) => (
          <button key={e} type="button" aria-pressed={emoji === e} onClick={() => setEmoji(e)}>
            {e}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary" onClick={submit}>
        <Check size={20} strokeWidth={2} />
        {editing ? 'Guardar cambios' : 'Crear categoría'}
      </button>
      {editing && (
        <button className="btn btn-danger" onClick={remove}>
          <Trash2 size={18} strokeWidth={1.75} />
          Borrar categoría
        </button>
      )}
    </Sheet>
  );
}
