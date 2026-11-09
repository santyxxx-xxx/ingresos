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
