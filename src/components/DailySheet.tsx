import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet } from './Sheet';
import { useFeedback } from './Feedback';
import { useAccount } from '../lib/account';
import { dailyCategoryIds, topLevel, useData } from '../lib/data';
import { haptic } from '../lib/utils';

/** Elegir qué categorías cuentan como gasto del día a día */
export function DailySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const account = useAccount();
  const { categories } = useData();
  const { toast } = useFeedback();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const roots = topLevel(categories, 'expense');

  useEffect(() => {
    if (open) {
      setSel(dailyCategoryIds(account.dailyCategories, categories));
      setSaving(false);
    }
  }, [open, account.dailyCategories, categories]);

  const toggle = (id: string) => {
    haptic(5);
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await account.setDailyCategories([...sel]);
      haptic(15);
      toast('Gasto diario actualizado');
      onClose();
    } catch (e) {
      setSaving(false);
      toast((e as Error).message, 'error');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Gasto diario">
      <p className="note" style={{ marginTop: -6 }}>
        Elige los gastos del día a día: comida, transporte, gasolina, servicios básicos… Las compras grandes o de una
        sola vez (un celular, un viaje) no deberían contar, así el promedio refleja lo que de verdad gastas cada día.
      </p>
      <div className="list-card glass">
        {roots.map((c) => (
          <button key={c.id} className="list-row check-row pressable" onClick={() => toggle(c.id)} aria-pressed={sel.has(c.id)}>
            <span className="badge">{c.emoji}</span>
            <span className="info">
              <span className="title">{c.name}</span>
              <span className="meta">{sel.has(c.id) ? 'Cuenta como gasto diario' : 'No cuenta'}</span>
            </span>
            <span className="checkbox" aria-hidden="true">
              {sel.has(c.id) && <Check size={15} strokeWidth={2.5} />}
            </span>
          </button>
        ))}
      </div>
      {sel.size === 0 && <p className="error-text">Elige al menos una categoría</p>}
      <button className="btn btn-primary" onClick={save} disabled={saving || sel.size === 0}>
        <Check size={20} strokeWidth={2} />
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      <p className="note" style={{ textAlign: 'center' }}>
        También puedes marcarlo al editar cada categoría. Incluye sus subcategorías.
      </p>
    </Sheet>
  );
}
