import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Sheet } from './Sheet';
import { Segmented } from './Segmented';
import { useFeedback } from './Feedback';
import { childrenOf, fetchCategoryUsage, useData } from '../lib/data';
import type { Category, TxType } from '../lib/types';
import { centsToInput, haptic, parseAmount } from '../lib/utils';

const EMOJIS: Record<TxType, string[]> = {
  expense: ['🍽️', '🛒', '☕', '🚕', '⛽', '🏠', '💡', '📱', '💊', '🏋️', '🎬', '🎮', '✈️', '📚', '👕', '🎁', '🐶', '💇', '🍻', '🧾', '🚗', '🛠️', '👶', '📦'],
  income: ['💼', '💻', '✨', '💰', '📈', '🏦', '🎁', '🧾', '🤝', '🏠', '🛍️', '🎓', '🪙', '💵', '🚀', '⭐']
};

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Category | null;
  defaultType: TxType;
  /** Si viene, se crea una subcategoría dentro de esta categoría */
  parent: Category | null;
}

export function CategorySheet({ open, onClose, editing, defaultType, parent }: Props) {
  const { uid, categories, catMap, saveCategory, deleteCategory } = useData();
  const { confirm, toast } = useFeedback();
  const [type, setType] = useState<TxType>(defaultType);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏷️');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [budget, setBudget] = useState('');

  const editingParent = editing?.parentId ? catMap.get(editing.parentId) : undefined;
  const isSub = !!parent || !!editing?.parentId;

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    if (editing) {
      setType(editing.type);
      setName(editing.name);
      setEmoji(editing.emoji);
      setBudget(editing.budget ? centsToInput(editing.budget) : '');
    } else {
      const t = parent?.type ?? defaultType;
      setType(t);
      setName('');
      setEmoji(parent?.emoji ?? EMOJIS[t][0]);
      setBudget('');
    }
  }, [open, editing, defaultType, parent]);

  const submit = async () => {
    const n = name.trim();
    if (!n) {
      setError('Escribe un nombre');
      haptic([20, 40, 20]);
      return;
    }
    let budgetCents: number | null = null;
    if (!isSub && type === 'expense' && budget.trim()) {
      budgetCents = parseAmount(budget);
      if (!Number.isFinite(budgetCents) || budgetCents <= 0) {
        setError('El presupuesto debe ser un monto mayor a 0');
        return;
      }
    }
    setSaving(true);
    try {
      await saveCategory({
        id: editing?.id,
        name: n,
        emoji: emoji.trim() || '🏷️',
        type,
        parentId: editing ? editing.parentId : parent?.id ?? null,
        budget: isSub ? undefined : type === 'expense' ? budgetCents : null
      });
      haptic(15);
      toast(editing ? 'Guardado' : isSub ? 'Subcategoría creada' : 'Categoría creada');
      onClose();
    } catch (e) {
      setSaving(false);
      setError((e as Error).message);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const usage = await fetchCategoryUsage(uid);
    const subs = editing.parentId ? [] : childrenOf(categories, editing.id);
    const own = usage.get(editing.id) ?? 0;
    const inSubs = subs.reduce((a, s) => a + (usage.get(s.id) ?? 0), 0);
    const total = own + inSubs;
    const mov = (n: number) => `${n} movimiento${n === 1 ? '' : 's'}`;

    let message: string;
    if (editing.parentId) {
      message =
        own > 0
          ? `Tiene ${mov(own)}. No se pierden: pasan a “${editingParent?.name ?? 'la categoría principal'}”.`
          : 'Esta subcategoría no tiene movimientos.';
    } else {
      const parts: string[] = [];
      if (subs.length) parts.push(`También se borrarán sus ${subs.length} subcategoría${subs.length === 1 ? '' : 's'}.`);
      parts.push(
        total > 0
          ? `Sus ${mov(total)} no se pierden: pasan a “Sin categoría”.`
          : 'No tiene movimientos.'
      );
      message = parts.join(' ');
    }

    const ok = await confirm({
      title: `Borrar “${editing.name}”`,
      message,
      confirmLabel: 'Borrar',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteCategory(editing);
      haptic([10, 30, 10]);
      toast(editing.parentId ? 'Subcategoría borrada' : 'Categoría borrada');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const title = editing
    ? editing.parentId
      ? 'Editar subcategoría'
      : 'Editar categoría'
    : parent
      ? `Nueva subcategoría`
      : 'Nueva categoría';

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {(parent || editingParent) && (
        <p className="note" style={{ marginTop: -6 }}>
          Dentro de <b>{(parent ?? editingParent)!.emoji} {(parent ?? editingParent)!.name}</b>
        </p>
      )}

      {!editing && !parent && (
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
            placeholder={isSub ? 'Ej. Supermercado' : 'Ej. Mascotas'}
            value={name}
            maxLength={40}
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

      {!isSub && type === 'expense' && (
        <div>
          <label className="field-label" htmlFor="cat-budget">
            Presupuesto mensual <span className="optional">(opcional)</span>
          </label>
          <div className="money-input">
            <span>$</span>
            <input
              id="cat-budget"
              className="input"
              inputMode="decimal"
              placeholder="Ej. 300"
              value={budget}
              onChange={(e) => {
                setError('');
                setBudget(e.target.value.replace(/[^\d.,]/g, '').slice(0, 12));
              }}
            />
          </div>
          <p className="note" style={{ marginTop: 6 }}>
            Te mostramos cuánto llevas gastado y te avisamos si te acercas al límite. Incluye sus subcategorías.
          </p>
        </div>
      )}

      <div className="emoji-grid">
        {EMOJIS[type].map((e) => (
          <button key={e} type="button" aria-pressed={emoji === e} onClick={() => setEmoji(e)}>
            {e}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary" onClick={submit} disabled={saving}>
        <Check size={20} strokeWidth={2} />
        {saving ? 'Guardando…' : editing ? 'Guardar cambios' : isSub ? 'Crear subcategoría' : 'Crear categoría'}
      </button>
      {editing && (
        <button className="btn btn-danger" onClick={remove}>
          <Trash2 size={18} strokeWidth={1.75} />
          {editing.parentId ? 'Borrar subcategoría' : 'Borrar categoría'}
        </button>
      )}
    </Sheet>
  );
}
