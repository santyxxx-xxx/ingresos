import { useState } from 'react';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { Segmented } from './Segmented';
import { useAccount } from '../lib/account';
import { haptic } from '../lib/utils';

export function AuthForm({ onDone }: { onDone?: () => void }) {
  const account = useAccount();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const submit = async () => {
    const e = email.trim().toLowerCase();
    setErr('');
    setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(e)) return setErr('Escribe un correo válido.');
    if (password.length < 6) return setErr('La contraseña debe tener al menos 6 caracteres.');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await account.signIn(e, password);
        haptic(15);
        onDone?.();
      } else {
        const r = await account.signUp(e, password);
        haptic(15);
        if (r === 'session') onDone?.();
        else {
          setInfo(`Te enviamos un correo a ${e}. Confírmalo con el enlace y luego entra aquí con tu contraseña.`);
          setMode('signin');
        }
      }
    } catch (x) {
      setErr((x as Error).message);
      haptic([20, 40, 20]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="auth-form"
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m);
          setErr('');
        }}
        options={[
          { value: 'signin', label: 'Entrar' },
          { value: 'signup', label: 'Crear cuenta' }
        ]}
      />
      <input
        className="input"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        placeholder="tu@correo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="pw-field">
        <input
          className="input"
          type={show ? 'text' : 'password'}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          placeholder={mode === 'signin' ? 'Contraseña' : 'Crea una contraseña (mín. 6)'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label="Mostrar contraseña">
          {show ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
        </button>
      </div>
      {err && <p className="error-text" style={{ marginTop: 0 }}>{err}</p>}
      {info && <p className="info-text">{info}</p>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {mode === 'signin' ? <LogIn size={19} strokeWidth={1.75} /> : <UserPlus size={19} strokeWidth={1.75} />}
        {busy ? 'Un momento…' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
      </button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function GoogleButton() {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <>
      <button
        type="button"
        className="btn btn-google"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr('');
          try {
            await account.signInWithGoogle();
          } catch (e) {
            setErr((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <GoogleIcon />
        {busy ? 'Abriendo Google…' : 'Continuar con Google'}
      </button>
      {err && <p className="error-text" style={{ marginTop: 0 }}>{err}</p>}
    </>
  );
}
