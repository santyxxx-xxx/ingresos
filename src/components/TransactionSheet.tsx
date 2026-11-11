import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Repeat, Split, Trash2 } from 'lucide-react';
import { Sheet } from './Sheet';
import { Segmented } from './Segmented';
import { CategoryPicker } from './CategoryPicker';
import { SectionPicker } from './SectionPicker';
import { useFeedback } from './Feedback';
import {
  TX_COLS,
  fetchPlaces,
  getLastSection,
  isTransfer,
  setLastSection,
  transferBase,
  txFromRow,
  useData,
  type TxRow
} from '../lib/data';
import { supabase } from '../lib/supabase';
import type { Frequency, Transaction, TxType } from '../lib/types';
import {
  WEEKDAYS,
  centsToInput,
  haptic,
  isoDow,
  money,
  normalizePlace,
  parseAmount,
  toISODate,
  todayISO
} from '../lib/utils';

type Mode = TxType | 'transfer';

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
  const {
    uid,
    catMap,
    groups,
    recurring,
    saveTransaction,
    deleteTransaction,
    addTransactions,
    saveRecurring,
    saveTransfer,
    deleteTransfer
  } = useData();
  const { confirm, toast } = useFeedback();
  const [mode, setMode] = useState<Mode>(defaultType);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [place, setPlace] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [places, setPlaces] = useState<string[]>([]);
  const [repeat, setRepeat] = useState(false);
  const [freq, setFreq] = useState<Frequency>('monthly');
  // Dividir ingreso
  const [split, setSplit] = useState(false);
  const [parts, setParts] = useState<Record<string, string>>({});
  // Transferencia
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const editingTransfer = !!editing && isTransfer(editing);
  const type: TxType = mode === 'income' ? 'income' : 'expense';
  const canTransfer = groups.length >= 2;

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    setRepeat(false);
    setFreq('monthly');
    setSplit(false);
    setParts({});
    if (editing) {
      setAmount(centsToInput(editing.amount));
      setPlace(editing.place);
      setDate(editing.date);
      if (isTransfer(editing)) {
        setMode('transfer');
        // Trae los dos lados de la transferencia para saber origen y destino
        const base = transferBase(editing.id);
        supabase
          .from('transactions')
          .select(TX_COLS)
          .eq('user_id', uid)
          .in('id', [`${base}-out`, `${base}-in`])
          .then(({ data }) => {
            const rows = ((data ?? []) as unknown as TxRow[]).map(txFromRow);
            setFrom(rows.find((r) => r.id.endsWith('-out'))?.sectionId ?? null);
            setTo(rows.find((r) => r.id.endsWith('-in'))?.sectionId ?? null);
          });
      } else {
        setMode(editing.type);
        setCategoryId(editing.categoryId);
        setSectionId(editing.sectionId);
      }
    } else {
      setMode(defaultType);
      setAmount('');
      setCategoryId(null);
      const last = getLastSection();
      const def = last && groups.some((g) => g.id === last) ? last : groups[0]?.id ?? null;
      setSectionId(def);
      setFrom(groups.find((g) => g.id !== def)?.id ?? null);
      setTo(def);
      setPlace('');
      setDate(todayISO());
      const t = setTimeout(() => amountRef.current?.focus({ preventScroll: true }), 380);
      return () => clearTimeout(t);
    }
  }, [open, editing, defaultType]);

  useEffect(() => {
    if (open && mode !== 'transfer') fetchPlaces(uid, type).then(setPlaces);
  }, [open, uid, type, mode]);

  const fromRule = editing?.recurringId ? recurring.find((r) => r.id === editing.recurringId) : undefined;

  const suggestions = useMemo(() => {
    const q = normalizePlace(place);
    return places.filter((p) => (q ? normalizePlace(p).includes(q) && normalizePlace(p) !== q : true)).slice(0, 6);
  }, [places, place]);

  const total = parseAmount(amount);
  const assigned = groups.reduce((a, g) => {
    const v = parseAmount(parts[g.id] ?? '');
    return a + (Number.isFinite(v) ? v : 0);
  }, 0);
  const remaining = (Number.isFinite(total) ? total : 0) - assigned;
  const dayNum = Number(date.slice(8, 10)) || 1;
  const dow = /^\d{4}-\d{2}-\d{2}$/.test(date) ? isoDow(date) : 1;

  const changeMode = (m: Mode) => {
    haptic(6);
    setMode(m);
    setError('');
    if (m !== 'income') setSplit(false);
    if (m !== 'transfer') {
      const c = categoryId ? catMap.get(categoryId) : undefined;
      if (c && c.type !== m) setCategoryId(null);
    }
  };

  const splitEvenly = () => {
    if (!Number.isFinite(total) || total <= 0 || groups.length === 0) return;
    const each = Math.floor(total / groups.length);
    const next: Record<string, string> = {};
    groups.forEach((g, i) => {
      const v = i === groups.length - 1 ? total - each * (groups.length - 1) : each;
      next[g.id] = centsToInput(v);
    });
    setParts(next);
  };

  const submit = async () => {
    const cents = parseAmount(amount);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError('Ingresa un monto mayor a 0');
      haptic([20, 40, 20]);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Elige una fecha válida');
      return;
    }

    // ----- Transferencia -----
    if (mode === 'transfer') {
      if (!from || !to) return setError('Elige de qué sección sale y a cuál va');
      if (from === to) return setError('Elige dos secciones distintas');
      setSaving(true);
      try {
        await saveTransfer({
          base: editingTransfer && editing ? transferBase(editing.id) : undefined,
          amount: cents,
          from,
          to,
          date,
          note: place.trim()
        });
        haptic(15);
        toast(editing ? 'Transferencia actualizada' : 'Transferencia registrada');
        onClose();
      } catch (e) {
        setSaving(false);
        setError((e as Error).message);
      }
      return;
    }

    const keepsUncategorized = editing && editing.categoryId === null && categoryId === null;
    if (!categoryId && !keepsUncategorized) {
      setError('Elige o crea una categoría');
      haptic([20, 40, 20]);
      return;
    }

    // ----- Ingreso dividido -----
    const splitting = split && mode === 'income' && !editing;
    const entries = splitting
      ? groups
          .map((g) => ({ sectionId: g.id as string | null, amount: parseAmount(parts[g.id] ?? '') }))
          .filter((e) => Number.isFinite(e.amount) && e.amount > 0)
      : [{ sectionId, amount: cents }];
    if (splitting) {
      if (entries.length === 0) return setError('Reparte el monto entre al menos una sección');
      if (remaining !== 0) {
        return setError(
          remaining > 0 ? `Falta repartir ${money(remaining)}` : `Repartiste ${money(-remaining)} de más`
        );
      }
    }

    setSaving(true);
    try {
      if (repeat && !editing) {
        for (const e of entries) {
          await saveRecurring({
            type,
            amount: e.amount,
            categoryId,
            sectionId: e.sectionId,
            place: place.trim(),
            frequency: freq,
            dayOfMonth: dayNum,
            dayOfWeek: freq === 'weekly' ? dow : null,
            startDate: date,
            active: true
          });
        }
        toast(freq === 'weekly' ? `Se repetirá cada ${WEEKDAYS[dow]}` : `Se repetirá el día ${dayNum} de cada mes`);
      } else if (splitting) {
        await addTransactions(
          entries.map((e) => ({ type, amount: e.amount, categoryId, sectionId: e.sectionId, place: place.trim(), date }))
        );
        toast(`Ingreso repartido en ${entries.length} secciones`);
      } else {
        await saveTransaction({ id: editing?.id, type, amount: cents, categoryId, sectionId, place: place.trim(), date });
        toast(editing ? 'Movimiento actualizado' : type === 'income' ? 'Ingreso guardado' : 'Gasto guardado');
      }
      if (!editing && !splitting) setLastSection(sectionId);
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
      title: editingTransfer ? 'Borrar transferencia' : 'Borrar movimiento',
      message: editingTransfer
        ? 'Se borran los dos lados de la transferencia (la salida y la entrada).'
        : 'Este movimiento se eliminará de forma permanente.',
      confirmLabel: 'Borrar',
      danger: true
    });
    if (!ok) return;
    try {
      if (editingTransfer) await deleteTransfer(transferBase(editing.id));
      else await deleteTransaction(editing.id);
      haptic([10, 30, 10]);
      toast(editingTransfer ? 'Transferencia borrada' : 'Movimiento borrado');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const modeOptions: Array<{ value: Mode; label: string }> = [
    { value: 'expense', label: 'Gasto' },
    { value: 'income', label: 'Ingreso' }
  ];
  if (canTransfer && (!editing || editingTransfer)) modeOptions.push({ value: 'transfer', label: 'Transferir' });

  const title = editing
    ? editingTransfer
      ? 'Editar transferencia'
      : 'Editar movimiento'
    : mode === 'transfer'
      ? 'Transferir entre secciones'
      : 'Nuevo movimiento';

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {!editingTransfer && (
        <Segmented
          value={mode}
          onChange={changeMode}
          tone={mode === 'transfer' ? undefined : mode}
          options={editing ? modeOptions.filter((o) => o.value !== 'transfer') : modeOptions}
        />
      )}

      <div className={`amount-field ${mode === 'transfer' ? 'transfer' : type}`}>
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

      {mode === 'transfer' ? (
        <>
          <p className="note" style={{ marginTop: -8 }}>
            Para pasar dinero de una sección a otra, por ejemplo de tu sueldo (Personal) a Casa. No cuenta como gasto ni
            como ingreso en el total.
          </p>
          <div>
            <span className="field-label">Sale de</span>
            <div className="chips">
              {groups.map((g) => (
                <button key={g.id} type="button" className="chip section" aria-pressed={from === g.id} onClick={() => setFrom(g.id)}>
                  <span className="e">{g.emoji}</span>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <div className="transfer-arrow" aria-hidden="true">
            <ArrowRight size={18} strokeWidth={1.75} />
          </div>
          <div style={{ marginTop: -10 }}>
            <span className="field-label">Va a</span>
            <div className="chips">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="chip section"
                  aria-pressed={to === g.id}
                  disabled={g.id === from}
                  onClick={() => setTo(g.id)}
                >
                  <span className="e">{g.emoji}</span>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="tx-note">
              Nota <span className="optional">(opcional)</span>
            </label>
            <input
              id="tx-note"
              className="input"
              placeholder="Ej. Aporte para la casa"
              value={place}
              maxLength={60}
              onChange={(e) => setPlace(e.target.value)}
            />
          </div>
        </>
      ) : (
        <>
          {mode === 'income' && !editing && groups.length >= 2 && (
            <button
              type="button"
              className={`toggle-row ${split ? 'on' : ''}`}
              onClick={() => {
                haptic(5);
                setSplit((s) => !s);
              }}
              aria-pressed={split}
            >
              <Split size={18} strokeWidth={1.75} />
              <span className="info">
                <span className="title">Dividir entre secciones</span>
                <span className="meta">Ej. sueldo: una parte a Casa y otra a Personal</span>
              </span>
              <span className="switch" aria-hidden="true" />
            </button>
          )}

          {split && mode === 'income' && !editing ? (
            <div className="split-box">
              {groups.map((g) => (
                <div className="split-row" key={g.id}>
                  <span className="split-name">
                    <span className="e">{g.emoji}</span> {g.name}
                  </span>
                  <div className="money-input">
                    <span>$</span>
                    <input
                      className="input"
                      inputMode="decimal"
                      placeholder="0"
                      value={parts[g.id] ?? ''}
                      onChange={(e) => {
                        setError('');
                        setParts((p) => ({ ...p, [g.id]: e.target.value.replace(/[^\d.,]/g, '').slice(0, 12) }));
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className="split-foot">
                <span className={remaining === 0 ? 'c-income' : remaining < 0 ? 'c-expense' : ''}>
                  {!Number.isFinite(total) || total <= 0
                    ? 'Primero escribe el monto total'
                    : remaining === 0
                      ? '✓ Todo repartido'
                      : remaining > 0
                        ? `Falta repartir ${money(remaining)}`
                        : `Te pasaste por ${money(-remaining)}`}
                </span>
                <button type="button" className="text-link" style={{ margin: 0 }} onClick={splitEvenly}>
                  Repartir en partes iguales
                </button>
              </div>
            </div>
          ) : (
            <SectionPicker value={sectionId} onChange={setSectionId} />
          )}

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
        </>
      )}

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

      {!editing && mode !== 'transfer' && (
        <div className={`repeat-box ${repeat ? 'on' : ''}`}>
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
              <span className="title">Repetir</span>
              <span className="meta">
                {repeat
                  ? freq === 'weekly'
                    ? `Se registrará solo cada ${WEEKDAYS[dow]}`
                    : `Se registrará solo el día ${dayNum} de cada mes`
                  : 'Para arriendo, suscripciones, mesada, sueldo…'}
              </span>
            </span>
            <span className="switch" aria-hidden="true" />
          </button>
          {repeat && (
            <Segmented
              value={freq}
              onChange={setFreq}
              options={[
                { value: 'monthly', label: 'Cada mes' },
                { value: 'weekly', label: 'Cada semana' }
              ]}
            />
          )}
        </div>
      )}

      {fromRule && (
        <p className="note">
          🔁 Este movimiento se creó automáticamente porque se repite{' '}
          {fromRule.frequency === 'weekly' && fromRule.dayOfWeek
            ? `cada ${WEEKDAYS[fromRule.dayOfWeek]}`
            : `el día ${fromRule.dayOfMonth} de cada mes`}
          . Cambiarlo aquí no afecta a los próximos: eso se edita en Movimientos → Recurrentes.
        </p>
      )}

      {error && <p className="error-text">{error}</p>}

      <button className="btn btn-primary" onClick={submit} disabled={saving}>
        <Check size={20} strokeWidth={2} />
        {saving ? 'Guardando…' : editing ? 'Guardar cambios' : mode === 'transfer' ? 'Transferir' : 'Guardar'}
      </button>
      {editing && (
        <button className="btn btn-danger" onClick={remove}>
          <Trash2 size={18} strokeWidth={1.75} />
          {editingTransfer ? 'Borrar transferencia' : 'Borrar movimiento'}
        </button>
      )}
    </Sheet>
  );
}
