import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const DURATION = 450;

export function Sheet({ open, onClose, title, children }: Props) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number; t: number } | null>(null);

  useEffect(() => {
    let t: number | undefined;
    if (open) {
      setMounted(true);
      // dos frames para que la transición arranque desde abajo
      t = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(t!);
    }
    setVisible(false);
    t = window.setTimeout(() => setMounted(false), DURATION);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { y: e.clientY, dy: 0, t: Date.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    sheetRef.current?.classList.add('dragging');
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current || !sheetRef.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current.dy = dy;
    sheetRef.current.style.transform = `translate3d(0, ${dy}px, 0)`;
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    const el = sheetRef.current;
    if (!el || !d) return;
    el.classList.remove('dragging');
    el.style.transform = '';
    const velocity = d.dy / Math.max(1, Date.now() - d.t);
    if (d.dy > 110 || velocity > 0.6) onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <div className={`sheet-root ${visible ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet glass" ref={sheetRef}>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="sheet-grab" />
          {title && (
            <div className="sheet-head">
              <h2>{title}</h2>
              <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
                <X size={18} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
