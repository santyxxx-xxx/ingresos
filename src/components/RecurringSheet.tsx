import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { Sheet } from './Sheet';
import { Segmented } from './Segmented';
import { CategoryPicker } from './CategoryPicker';
import { SectionPicker } from './SectionPicker';
import { useFeedback } from './Feedback';
import { catInfo, useData } from '../lib/data';
import type { Frequency, Recurring, TxType } from '../lib/types';
import { WEEKDAYS, WEEKDAYS_SHORT, centsToInput, haptic, isoDow, money, parseAmount, todayISO } from '../lib/utils';

/** Aproximación mensual: un recurrente semanal ocurre ~52/12 veces al mes */
const perMonth = (r: Recurring) => (r.frequency === 'weekly' ? Math.round((r.amount * 52) / 12) : r.amount);
const when = (r: Recurring) =>
  r.frequency === 'weekly' && r.dayOfWeek ? `Cada ${WEEKDAYS[r.dayOfWeek]}` : `Día ${r.dayOfMonth} de cada mes`;

export function RecurringSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { recurring, catMap, groupMap, groups, saveRecurring, deleteRecurring } = useData();
  const { confirm, toast } = useFeedback();
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Recurring | null>(null);

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [place, setPlace] = useState('');
  const [day, setDay] = useState(1);
  const [freq, setFreq] = useState<Frequency>('monthly');
  const [dow, setDow] = useState(1);
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setMode('list');
  }, [open]);

  const startForm = (r: Recurring | null) => {
    setEditing(r);
    setType(r?.type ?? 'expense');
    setAmount(r ? centsToInput(r.amount) : '');
    setCategoryId(r?.categoryId ?? null);
    setSectionId(r ? r.sectionId : groups[0]?.id ?? null);
    setPlace(r?.place ?? '');
    setDay(r?.dayOfMonth ?? new Date().getDate());
    setFreq(r?.frequency ?? 'monthly');
    setDow(r?.dayOfWeek ?? isoDow(todayISO()));
    setActive(r?.active ?? true);
    setError('');
    setSaving(false);
    setMode('form');
  };

  const submit = async () => {
    const cents = parseAmount(amount);
    if (!Number.isFinite(cents) || cents <= 0) return setError('Ingresa un monto mayor a 0');
    if (!categoryId) return setError('Elige una categoría');
    setSaving(true);
    try {
      await saveRecurring({
        id: editing?.id,
        type,
        amount: cents,
        categoryId,
        sectionId,
        place: place.trim(),
        dayOfMonth: day,
        frequency: freq,
        dayOfWeek: freq === 'weekly' ? dow : null,
        startDate: editing?.startDate ?? todayISO(),
        active
      });
      haptic(15);
      toast(editing ? 'Recurrente actualizado' : 'Recurrente creado');
      setMode('list');
    } catch (e) {
      setSaving(false);
      setError((e as Error).message);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: 'Borrar recurrente',
      message: 'Dejará de registrarse cada mes. Los movimientos que ya se crearon se conservan.',
      confirmLabel: 'Borrar',
      danger: true
    });
    if (!ok) return;
    try {
      await deleteRecurring(editing.id);
      toast('Recurrente borrado');
      setMode('list');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const toggleActive = async (r: Recurring) => {
    try {
      await saveRecurring({ ...r, active: !r.active });
      haptic(8);
      toast(r.active ? 'Pausado' : 'Reactivado');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const monthlyExpense = recurring.filter((r) => r.active && r.type === 'expense').reduce((a, r) => a + perMonth(r), 0);
  const monthlyIncome = recurring.filter((r) => r.active && r.type === 'income').reduce((a, r) => a + perMonth(r), 0);
  const approx = recurring.some((r) => r.active && r.frequency === 'weekly') ? '≈ ' : '';

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'list' ? 'Recurrentes' : editing ? 'Editar recurrente' : 'Nuevo recurrente'}>
      {mode === 'list' ? (
        <>
          <p className="note" style={{ marginTop: -6 }}>
            Gastos o ingresos que se repiten cada mes o cada semana (arriendo, Netflix, mesada, sueldo). Se registran
            solos el día que elijas.
          </p>
          {recurring.length > 0 && (
            <div className="summary-line">
              <div className="pill glass">
                <small>Gastos fijos al mes</small>
                <b className="c-expense">
                  {approx}
                  {money(monthlyExpense)}
                </b>
              </div>
              <div className="pill glass">
                <small>Ingresos fijos al mes</small>
                <b className="c-income">
                  {approx}
                  {money(monthlyIncome)}
                </b>
              </div>
            </div>
          )}
          {recurring.length > 0 ? (
            <div className="list-card glass">
              {recurring.map((r) => {
                const c = catInfo(catMap, r.categoryId);
                return (
                  <div className={`list-row rec-row ${r.active ? '' : 'paused'}`} key={r.id}>
                    <button className="rec-main pressable" onClick={() => startForm(r)}>
                      <span className="badge">{c.emoji}</span>
                      <span className="info">
                        <span className="title">{r.place || c.name}</span>
                        <span className="meta">
                          {when(r)} · {c.full}
                          {r.sectionId && groupMap.get(r.sectionId) ? ` · ${groupMap.get(r.sectionId)!.name}` : ''}
                          {!r.active && ' · en pausa'}
                        </span>
                      </span>
                      <span className={`amount ${r.type === 'income' ? 'c-income' : ''}`}>
                        {r.type === 'income' ? '+' : '−'}
                        {money(r.amount)}
                      </span>
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => toggleActive(r)}
                      aria-label={r.active ? 'Pausar' : 'Reactivar'}
                    >
                      {r.active ? <Pause size={16} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card glass empty">
              <div className="art">🔁</div>
              <p>Aún no tienes movimientos recurrentes.</p>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => startForm(null)}>
            <Plus size={20} strokeWidth={2} />
            Nuevo recurrente
          </button>
        </>
      ) : (
        <>
          <button className="back-link" onClick={() => setMode('list')}>
            <ArrowLeft size={16} strokeWidth={1.75} /> Volver
          </button>
          <Segmented
            value={type}
            tone={type}
            onChange={(t) => {
              setType(t);
              const c = categoryId ? catMap.get(categoryId) : undefined;
              if (c && c.type !== t) setCategoryId(null);
            }}
            options={[
              { value: 'expense', label: 'Gasto' },
              { value: 'income', label: 'Ingreso' }
            ]}
          />
          <div className={`amount-field ${type}`}>
            <span className="cur">$</span>
            <input
              inputMode="decimal"
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
            onChange={(id) => {
              setError('');
              setCategoryId(id);
            }}
          />
          <div>
            <label className="field-label" htmlFor="rec-place">
              Descripción o lugar
            </label>
            <input
              id="rec-place"
              className="input"
              placeholder="Ej. Arriendo, Netflix, Sueldo"
              value={place}
              maxLength={60}
              onChange={(e) => setPlace(e.target.value)}
            />
          </div>
          <div>
            <span className="field-label">Se repite</span>
            <Segmented
              value={freq}
              onChange={setFreq}
              options={[
                { value: 'monthly', label: 'Cada mes' },
                { value: 'weekly', label: 'Cada semana' }
              ]}
            />
          </div>
          {freq === 'weekly' ? (
            <div>
              <span className="field-label">Día de la semana</span>
              <div className="day-grid">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <button key={d} type="button" aria-pressed={dow === d} onClick={() => setDow(d)} aria-label={WEEKDAYS[d]}>
                    {WEEKDAYS_SHORT[d]}
                  </button>
                ))}
              </div>
              <p className="note" style={{ marginTop: 6 }}>
                Se registra cada {WEEKDAYS[dow]}. Unas {Math.round((52 / 12) * 10) / 10} veces al mes.
              </p>
            </div>
          ) : (
          <div>
            <span className="field-label">Día del mes</span>
            <div className="day-grid">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(d)}>
                  {d}
                </button>
              ))}
            </div>
            {day > 28 && <p className="note" style={{ marginTop: 6 }}>En meses más cortos se registra el último día.</p>}
          </div>
          )}
          {editing && (
            <button type="button" className={`toggle-row ${active ? 'on' : ''}`} onClick={() => setActive((a) => !a)}>
              <Play size={18} strokeWidth={1.75} />
              <span className="info">
                <span className="title">Activo</span>
                <span className="meta">
                  {active ? (freq === 'weekly' ? 'Se registra cada semana' : 'Se registra cada mes') : 'En pausa: no se registra'}
                </span>
              </span>
              <span className="switch" aria-hidden="true" />
            </button>
          )}
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            <Check size={20} strokeWidth={2} />
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear recurrente'}
          </button>
          {editing && (
            <button className="btn btn-danger" onClick={remove}>
              <Trash2 size={18} strokeWidth={1.75} />
              Borrar recurrente
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}
