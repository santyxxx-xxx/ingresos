import type { Category, Transaction } from '../lib/types';
import { catInfo, isTransfer, useData } from '../lib/data';
import { money, shortDate } from '../lib/utils';

export function TxRow({
  tx,
  cats,
  onClick,
  showDate,
  transfer,
  totalView = true
}: {
  tx: Transaction;
  cats: Map<string, Category>;
  onClick: () => void;
  showDate?: boolean;
  /** Origen y destino, si es una transferencia */
  transfer?: { from: string | null; to: string | null };
  /** En la vista Total una transferencia se muestra una sola vez, sin signo */
  totalView?: boolean;
}) {
  const { groupMap } = useData();
  const date = showDate ? ` · ${shortDate(tx.date)}` : '';

  if (isTransfer(tx)) {
    const name = (id: string | null | undefined) => (id ? groupMap.get(id)?.name ?? '—' : '—');
    const out = tx.id.endsWith('-out');
    return (
      <button className="tx pressable" onClick={onClick}>
        <span className="badge">↔️</span>
        <span className="info">
          <span className="title">{tx.place || 'Transferencia'}</span>
          <span className="meta">
            {totalView
              ? `${name(transfer?.from)} → ${name(transfer?.to)}`
              : out
                ? `Enviado a ${name(transfer?.to)}`
                : `Recibido de ${name(transfer?.from)}`}
            {date}
          </span>
        </span>
        <span className={`amount ${totalView ? 'c-muted' : out ? '' : 'c-income'}`}>
          {totalView ? '' : out ? '−' : '+'}
          {money(tx.amount)}
        </span>
      </button>
    );
  }

  const c = catInfo(cats, tx.categoryId);
  const section = tx.sectionId ? groupMap.get(tx.sectionId) : undefined;
  const sign = tx.type === 'income' ? '+' : '−';
  return (
    <button className="tx pressable" onClick={onClick}>
      <span className="badge">{c.emoji}</span>
      <span className="info">
        <span className="title">{tx.place || c.name}</span>
        <span className="meta">
          {tx.place ? c.full : tx.type === 'income' ? 'Ingreso' : 'Gasto'}
          {date}
          {section && ` · ${section.emoji} ${section.name}`}
          {tx.recurringId && ' · 🔁'}
        </span>
      </span>
      <span className={`amount ${tx.type === 'income' ? 'c-income' : ''}`}>
        {sign}
        {money(tx.amount)}
      </span>
    </button>
  );
}
