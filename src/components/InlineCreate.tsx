import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

/** Fila para crear algo sin salir de la pantalla (categoría, subcategoría o sección) */
export function InlineCreate({
  placeholder,
  defaultEmoji,
  onCreate,
  onCancel
}: {
  placeholder: string;
  defaultEmoji: string;
  onCreate: (name: string, emoji: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(defaultEmoji);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, []);

  const submit = async () => {
    const n = name.trim();
    if (!n) return setErr('Escribe un nombre');
    setBusy(true);
    setErr('');
    try {
      await onCreate(n, emoji.trim() || defaultEmoji);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="inline-create">
      <div className="inline-create-row">
        <input
          className="input emoji-in"
          value={emoji}
          aria-label="Emoji"
          onChange={(e) => setEmoji([...e.target.value].slice(-2).join(''))}
        />
        <input
          ref={ref}
          className="input"
          placeholder={placeholder}
          value={name}
          maxLength={40}
          autoCapitalize="sentences"
          enterKeyHint="done"
          onChange={(e) => {
            setErr('');
            setName(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className="icon-btn ok" onClick={submit} disabled={busy} aria-label="Crear">
          <Check size={20} strokeWidth={2} />
        </button>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Cancelar">
          <X size={18} strokeWidth={2} />
        </button>
      </div>
      {err && <p className="error-text" style={{ margin: '6px 0 0' }}>{err}</p>}
    </div>
  );
}
