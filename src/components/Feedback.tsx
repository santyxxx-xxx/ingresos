import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Sheet } from './Sheet';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface Ctx {
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  toast: (msg: string, kind?: 'ok' | 'error') => void;
}

const FeedbackCtx = createContext<Ctx | null>(null);

export function useFeedback() {
  const c = useContext(FeedbackCtx);
  if (!c) throw new Error('FeedbackProvider missing');
  return c;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const [toastMsg, setToastMsg] = useState<{ id: number; text: string; out: boolean; kind: 'ok' | 'error' } | null>(null);
  const toastTimer = useRef<number[]>([]);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((res) => {
      resolver.current = res;
    });
  }, []);

  const finish = useCallback((v: boolean) => {
    setOpen(false);
    resolver.current?.(v);
    resolver.current = null;
  }, []);

  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    toastTimer.current.forEach(clearTimeout);
    const id = Date.now();
    setToastMsg({ id, text, out: false, kind });
    toastTimer.current = [
      window.setTimeout(() => setToastMsg((t) => (t && t.id === id ? { ...t, out: true } : t)), kind === 'error' ? 3800 : 1900),
      window.setTimeout(() => setToastMsg((t) => (t && t.id === id ? null : t)), kind === 'error' ? 4150 : 2250)
    ];
  }, []);

  return (
    <FeedbackCtx.Provider value={{ confirm, toast }}>
      {children}
      <Sheet open={open} onClose={() => finish(false)} title={opts?.title}>
        <p className="confirm-text">{opts?.message}</p>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => finish(false)}>
            Cancelar
          </button>
          <button
            className={`btn ${opts?.danger ? 'btn-danger-solid' : 'btn-primary'}`}
            onClick={() => finish(true)}
          >
            {opts?.confirmLabel ?? 'Aceptar'}
          </button>
        </div>
      </Sheet>
      {toastMsg && (
        <div className="toast-host" aria-live="polite">
          <div key={toastMsg.id} className={`toast glass glass-strong ${toastMsg.kind} ${toastMsg.out ? 'out' : ''}`}>
            {toastMsg.kind === 'error' ? <AlertCircle size={18} strokeWidth={2} /> : <CheckCircle2 size={18} strokeWidth={2} />}
            {toastMsg.text}
          </div>
        </div>
      )}
    </FeedbackCtx.Provider>
  );
}
