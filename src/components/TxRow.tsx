import type { Category, Transaction } from '../lib/types';
import { catInfo } from '../lib/hooks';
import { money, shortDate } from '../lib/utils';

export function TxRow({ tx, cats, onClick, showDate }: {
  tx: Transaction;
  cats: Map<string, Category>;
  onClick: () => void;
  showDate?: boolean;
}) {
  const c = catInfo(cats, tx.categoryId);
  const sign = tx.type === 'income' ? '+' : '−';
  return (
    <button className="tx pressable" onClick={onClick}>
      <span className="badge">{c.emoji}</span>
      <span className="info">
        <span className="title">{tx.place || c.name}</span>
        <span className="meta">
          {tx.place ? c.name : tx.type === 'income' ? 'Ingreso' : 'Gasto'}
          {showDate && ` · ${shortDate(tx.date)}`}
        </span>
      </span>
      <span className={`amount ${tx.type === 'income' ? 'c-income' : ''}`}>
        {sign}
        {money(tx.amount)}
      </span>
    </button>
  );
}
