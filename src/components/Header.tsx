import { Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';

export function Header({ title, eyebrow, onSettings, right }: {
  title: ReactNode;
  eyebrow?: string;
  onSettings?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
      </div>
      {right}
      {onSettings && (
        <button className="icon-btn glass" onClick={onSettings} aria-label="Ajustes y respaldo">
          <Settings2 size={20} strokeWidth={1.75} />
        </button>
      )}
    </header>
  );
}
