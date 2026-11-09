import { LogOut, UserRound } from 'lucide-react';
import { useAccount } from '../lib/account';
import { useFeedback } from './Feedback';

export function AccountSection() {
  const a = useAccount();
  const { confirm } = useFeedback();

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
      <span className="field-label">Cuenta</span>
      <div className="cloud-card glass">
        <div className="cloud-head">
          <span className="badge ok">
            <UserRound size={20} strokeWidth={1.75} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="cloud-title">{a.email}</div>
            <div className="cloud-meta">Tus datos se guardan en tu cuenta y los ves en cualquier dispositivo.</div>
          </div>
        </div>
        <button className="btn btn-danger" onClick={signOut}>
          <LogOut size={18} strokeWidth={1.75} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
