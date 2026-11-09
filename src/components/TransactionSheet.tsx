import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Repeat, Trash2 } from 'lucide-react';
import { Sheet } from './Sheet';
import { Segmented } from './Segmented';
import { CategoryPicker } from './CategoryPicker';
import { SectionPicker } from './SectionPicker';
import { useFeedback } from './Feedback';
import { fetchPlaces, getLastSection, setLastSection, useData } from '../lib/data';
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
  const { uid, catMap, groups, recurring, saveTransaction, deleteTransaction, saveRecurring } = useData();
  const { confirm, toast } = useFeedback();
  const [type, setType] = useState<TxType>(defaultType);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [place, setPlace] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [places, setPlaces] = useState<string[]>([]);
  const [repeat, setRepeat] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    setRepeat(false);
    if (editing) {
      setType(editing.type);
      setAmount(centsToInput(editing.amount));
      setCategoryId(editing.categoryId);
      setSectionId(editing.sectionId);
      setPlace(editing.place);
      setDate(editing.date);
    } else {
      setType(defaultType);
      setAmount('');
      setCategoryId(null);
      // Se propone la última sección usada
      const last = getLastSection();
      setSectionId(last && groups.some((g) => g.id === last) ? last : groups[0]?.id ?? null);
      setPlace('');
      setDate(todayISO());
      const t = setTimeout(() => amountRef.current?.focus({ preventScroll: true }), 380);
      return () => clearTimeout(t);
    }
    // groups solo se usa para la propuesta inicial
  }, [open, editing, defaultType]);

  useEffect(() => {
    if (open) fetchPlaces(uid, type).then(setPlaces);
  }, [open, uid, type]);

  const fromRule = editing?.recurringId ? recurring.find((r) => r.id === editing.recurringId) : undefined;

  const suggestions = useMemo(() => {
    const q = normalizePlace(place);
    return places.filter((p) => (q ? normalizePlace(p).includes(q) && normalizePlace(p) !== q : true)).slice(0, 6);
  }, [places, place]);

  const changeType = (t: TxType) => {
    haptic(6);
    setType(t);
    const c = categoryId ? catMap.get(categoryId) : undefined;
    if (c && c.type !== t) setCategoryId(null);
  };

  const submit = async () => {
    const cents = parseAmount(amount);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError('Ingresa un monto mayor a 0');
      haptic([20, 40, 20]);
      return;
    }
    const keepsUncategorized = editing && editing.categoryId === null && categoryId === null;
    if (!categoryId && !keepsUncategorized) {
      setError('Elige o crea una categoría');
      haptic([20, 40, 20]);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Elige una fecha válida');
      return;
    }
    setSaving(true);
    try {
      if (repeat && !editing) {
        await saveRecurring({
          type,
          amount: cents,
          categoryId,
          sectionId,
          place: place.trim(),
          dayOfMonth: Number(date.slice(8, 10)),
          startDate: date,
          active: true
        });
        toast(`Se repetirá el día ${Number(date.slice(8, 10))} de cada mes`);
      } else {
        await saveTransaction({ id: editing?.id, type, amount: cents, categoryId, sectionId, place: place.trim(), date });
        toast(editing ? 'Movimiento actualizado' : type === 'income' ? 'Ingreso guardado' : 'Gasto guardado');
      }
      if (!editing) setLastSection(sectionId);
      haptic(15);
      onClose();
    } catch (e) {
      setSaving(false);
      setError((e as Error).message);
    }
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
    try {
      await deleteTransaction(editing.id);
      haptic([10, 30, 10]);
      toast('Movimiento borrado');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
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

      <SectionPicker value={sectionId} onChange={setSectionId} />

      <CategoryPicker
        type={type}
        value={categoryId}
        allowNone={!!editing && editing.categoryId === null}
        onChange={(id) => {
          setError('');
          setCategoryId(id);
        }}
      />

      <div>
        <label className="field-label" htmlFor="tx-place">
          {type === 'income' ? 'De dónde viene' : 'Lugar'}
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

      {!editing && (
        <button
          type="button"
          className={`toggle-row ${repeat ? 'on' : ''}`}
          onClick={() => {
            haptic(5);
            setRepeat((r) => !r);
          }}
          aria-pressed={repeat}
        >
          <Repeat size={18} strokeWidth={1.75} />
          <span className="info">
            <span className="title">Repetir cada mes</span>
            <span className="meta">
              {repeat
                ? `Se registrará solo el día ${Number(date.slice(8, 10)) || 1} de cada mes`
                : 'Para arriendo, suscripciones, sueldo…'}
            </span>
          </span>
          <span className="switch" aria-hidden="true" />
        </button>
      )}

      {fromRule && (
        <p className="note">
          🔁 Este movimiento se creó automáticamente porque se repite el día {fromRule.dayOfMonth} de cada mes.
          Cambiarlo aquí no afecta a los próximos meses: eso se edita en Movimientos → Recurrentes.
        </p>
      )}

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary" onClick={submit} disabled={saving}>
        <Check size={20} strokeWidth={2} />
        {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar'}
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
