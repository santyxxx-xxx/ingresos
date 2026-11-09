import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAccount } from '../lib/account';

/** Pantalla de bienvenida: pide el nombre la primera vez */
export function NameStep() {
  const account = useAccount();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    const n = name.trim();
    if (!n) return setErr('Escribe tu nombre');
    setBusy(true);
    try {
      await account.setName(n);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="backdrop-art" aria-hidden="true">
        <span className="b1" />
        <span className="b2" />
        <span className="b3" />
      </div>
      <div className="welcome">
        <div className="welcome-inner anim-fade">
          <div className="welcome-wave">👋</div>
          <h1>¡Hola!</h1>
          <p className="welcome-sub">¿Cómo te llamas? Así te saludamos cada vez que entres.</p>
          <form
            className="card glass auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              className="input"
              autoFocus
              autoComplete="given-name"
              autoCapitalize="words"
              placeholder="Tu nombre"
              maxLength={40}
              value={name}
              onChange={(e) => {
                setErr('');
                setName(e.target.value);
              }}
            />
            {err && <p className="error-text" style={{ marginTop: 0 }}>{err}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Continuar'}
              <ArrowRight size={19} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
