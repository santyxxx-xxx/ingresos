import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Trash2 } from 'lucide-react';
import { Sheet } from './Sheet';
import { Segmented } from './Segmented';
import { useFeedback } from './Feedback';
import { db, deleteTransaction, saveTransaction } from '../lib/db';
import { useCategories } from '../lib/hooks';
import type { Transaction, TxType } from '../lib/types';
import { centsToInput, haptic, normalizePlace, parseAmount, toISODate, todayISO } from '../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Transaction | null;
  defaultType: TxType;
}

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toISODate(d);
}

export function TransactionSheet({ open, onClose, editing, defaultType }: Props) {
  const { list: cats } = useCategories();
  const { confirm, toast } = useFeedback();
  const [type, setType] = useState<TxType>(defaultType);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [place, setPlace] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  // Reinicia el formulario cada vez que se abre
  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    if (editing) {
      setType(editing.type);
      setAmount(centsToInput(editing.amount));
      setCategoryId(editing.categoryId);
      setPlace(editing.place);
      setDate(editing.date);
    } else {
      setType(defaultType);
      setAmount('');
      setCategoryId(null);
      setPlace('');
      setDate(todayISO());
      const t = setTimeout(() => amountRef.current?.focus({ preventScroll: true }), 380);
      return () => clearTimeout(t);
    }
  }, [open, editing, defaultType]);

  const typeCats = useMemo(() => cats.filter((c) => c.type === type), [cats, type]);

  // Lugares usados antes, ordenados por frecuencia
  const allPlaces = useLiveQuery(async () => {
    if (!open) return [] as string[];
    const freq = new Map<string, { label: string; n: number }>();
    await db.transactions.each((t) => {
      if (!t.place || t.deleted) return;
      const k = normalizePlace(t.place);
      const cur = freq.get(k);
      if (cur) cur.n++;
      else freq.set(k, { label: t.place.trim(), n: 1 });
    });
    return [...freq.values()].sort((a, b) => b.n - a.n).map((x) => x.label);
  }, [open]);

  const suggestions = useMemo(() => {
    const q = normalizePlace(place);
    return (allPlaces ?? [])
      .filter((p) => (q ? normalizePlace(p).includes(q) && normalizePlace(p) !== q : true))
      .slice(0, 6);
  }, [allPlaces, place]);

  const changeType = (t: TxType) => {
    haptic(6);
    setType(t);
    const cur = cats.find((c) => c.id === categoryId);
    if (cur && cur.type !== t) setCategoryId(null);
  };

  const submit = async () => {
    const cents = parseAmount(amount);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError('Ingresa un monto mayor a 0');
      haptic([20, 40, 20]);
      return;
    }
    const keepsUncategorized = editing && editing.categoryId === null && categoryId === null;
    if (!categoryId && typeCats.length > 0 && !keepsUncategorized) {
      setError('Elige una categoría');
      haptic([20, 40, 20]);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Elige una fecha válida');
      return;
    }
    setSaving(true);
    await saveTransaction({
      id: editing?.id,
      type,
      amount: cents,
      categoryId,
      place: place.trim(),
      date
    });
    haptic(15);
    toast(editing ? 'Movimiento actualizado' : type === 'income' ? 'Ingreso guardado' : 'Gasto guardado');
    onClose();
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: 'Borrar movimiento',
      message: 'Este movimiento se eliminará de forma permanente.',
      confirmLabel: 'Borrar',
      danger: true
    });
    if (!ok) return;
    await deleteTransaction(editing.id);
    haptic([10, 30, 10]);
    toast('Movimiento borrado');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}>
      <Segmented
        value={type}
        onChange={changeType}
        tone={type}
        options={[
          { value: 'expense', label: 'Gasto' },
          { value: 'income', label: 'Ingreso' }
        ]}
      />

      <div className={`amount-field ${type}`}>
        <span className="cur">$</span>
        <input
          ref={amountRef}
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          placeholder="0,00"
          value={amount}
          aria-label="Monto"
          onChange={(e) => {
            setError('');
            setAmount(e.target.value.replace(/[^\d.,]/g, '').slice(0, 12));
          }}
        />
      </div>

      <div>
        <span className="field-label">Categoría</span>
        <div className="chips">
          {typeCats.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${type}`}
              aria-pressed={categoryId === c.id}
              onClick={() => {
                haptic(5);
                setError('');
                setCategoryId(c.id);
              }}
            >
              <span className="e">{c.emoji}</span>
              {c.name}
            </button>
          ))}
          {editing && editing.categoryId === null && (
            <button
              type="button"
              className={`chip ${type}`}
              aria-pressed={categoryId === null}
              onClick={() => setCategoryId(null)}
            >
              <span className="e">❔</span>Sin categoría
            </button>
          )}
          {typeCats.length === 0 && (
            <p className="note">No tienes categorías de {type === 'income' ? 'ingreso' : 'gasto'}. Puedes crearlas en la pestaña Categorías.</p>
          )}
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="tx-place">
          Lugar
        </label>
        <input
          id="tx-place"
          className="input"
          placeholder={type === 'income' ? 'Ej. Empresa, cliente…' : 'Ej. Supermaxi, Uber…'}
          value={place}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          maxLength={60}
          onChange={(e) => setPlace(e.target.value)}
        />
        {suggestions.length > 0 && (
          <div className="chips" style={{ marginTop: 10 }}>
            {suggestions.map((p) => (
              <button key={p} type="button" className="chip small" onClick={() => setPlace(p)}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="field-label" htmlFor="tx-date">
          Fecha
        </label>
        <div className="chips" style={{ marginBottom: 10 }}>
          <button type="button" className="chip small" aria-pressed={date === todayISO()} onClick={() => setDate(todayISO())}>
            Hoy
          </button>
          <button type="button" className="chip small" aria-pressed={date === yesterdayISO()} onClick={() => setDate(yesterdayISO())}>
            Ayer
          </button>
        </div>
        <input id="tx-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary" onClick={submit} disabled={saving}>
        <Check size={20} strokeWidth={2} />
        {editing ? 'Guardar cambios' : 'Guardar'}
      </button>
      {editing && (
        <button className="btn btn-danger" onClick={remove}>
          <Trash2 size={18} strokeWidth={1.75} />
          Borrar movimiento
        </button>
      )}
    </Sheet>
  );
}
