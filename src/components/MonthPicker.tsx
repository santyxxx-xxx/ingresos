import { ChevronLeft, ChevronRight } from 'lucide-react';
import { currentMonth, monthLabel, shiftMonth, haptic } from '../lib/utils';

export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const isCurrent = month === currentMonth();
  const go = (d: number) => {
    haptic(6);
    onChange(shiftMonth(month, d));
  };
  return (
    <div className="month-picker glass no-select">
      <button className="icon-btn" onClick={() => go(-1)} aria-label="Mes anterior">
        <ChevronLeft size={20} strokeWidth={1.75} />
      </button>
      <button className="label" onClick={() => onChange(currentMonth())}>
        {monthLabel(month)}
        {!isCurrent && <small>Volver al mes actual</small>}
      </button>
      <button className="icon-btn" onClick={() => go(1)} aria-label="Mes siguiente">
        <ChevronRight size={20} strokeWidth={1.75} />
      </button>
    </div>
  );
}
