import { useEffect, useState } from 'react';
import { Check, LogOut } from 'lucide-react';
import { useAccount } from '../lib/account';
import { useFeedback } from './Feedback';

export function AccountSection() {
  const a = useAccount();
  const { confirm, toast } = useFeedback();
  const [name, setName] = useState(a.name ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => setName(a.name ?? ''), [a.name]);

  const saveName = async () => {
    const n = name.trim();
    if (!n || n === a.name) return;
    setBusy(true);
    try {
      await a.setName(n);
      toast('Nombre actualizado');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    const ok = await confirm({
      title: 'Cerrar sesión',
      message: 'Tus datos siguen guardados en tu cuenta. Podrás verlos al entrar desde cualquier dispositivo.',
      confirmLabel: 'Cerrar sesión'
    });
    if (ok) await a.signOut();
  };

  return (
    <div>
      <span className="field-label">Tu cuenta</span>
      <div className="cloud-card glass">
        <div>
          <label className="field-label" htmlFor="acc-name">
            Nombre
          </label>
          <div className="btn-row">
            <input
              id="acc-name"
              className="input"
              value={name}
              maxLength={40}
              autoCapitalize="words"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
            />
            {name.trim() && name.trim() !== a.name && (
              <button className="icon-btn btn-primary save-name" onClick={saveName} disabled={busy} aria-label="Guardar nombre">
                <Check size={20} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
        <p className="cloud-meta" style={{ marginTop: 0 }}>
          Conectado como <b>{a.email}</b>
        </p>
        <button className="btn btn-logout" onClick={signOut}>
          <LogOut size={18} strokeWidth={1.75} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
