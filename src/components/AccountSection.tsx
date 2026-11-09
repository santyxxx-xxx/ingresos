import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react';
import { timeAgo, useAccount } from '../lib/account';
import { useFeedback } from './Feedback';
import { AuthForm } from './AuthForm';

export function AccountSection() {
  const a = useAccount();
  const { confirm, toast } = useFeedback();
  if (!a.enabled) return null;

  const statusText = () => {
    if (a.status === 'syncing') return 'Sincronizando…';
    if (a.status === 'offline') return a.pending ? `Sin conexión · ${a.pending} cambio(s) por subir` : 'Sin conexión';
    if (a.status === 'error') return a.error ?? 'No se pudo sincronizar';
    if (a.pending) return `${a.pending} cambio(s) por subir`;
    return a.lastSync ? `Sincronizado ${timeAgo(a.lastSync)}` : 'Conectado';
  };

  const signOut = async () => {
    const ok = await confirm({
      title: 'Cerrar sesión',
      message: a.pending
        ? `Hay ${a.pending} cambio(s) que aún no se subieron${navigator.onLine ? ' (se intentará subirlos ahora)' : ' y no hay conexión: se perderán'}. Al salir, los datos se borran de este dispositivo; siguen en tu cuenta.`
        : 'Tus datos siguen guardados en tu cuenta. Se borrarán de este dispositivo hasta que vuelvas a entrar.',
      confirmLabel: 'Cerrar sesión',
      danger: !!a.pending && !navigator.onLine
    });
    if (!ok) return;
    await a.signOut();
    toast('Sesión cerrada');
  };

  return (
    <div>
      <span className="field-label">Cuenta</span>
      <div className="cloud-card glass">
        {!a.session ? (
          <>
            <p className="note" style={{ padding: 0 }}>
              Entra o crea tu cuenta para guardar tus datos en la nube y verlos en todos tus dispositivos. Lo que ya
              registraste aquí se sube a tu cuenta.
            </p>
            <AuthForm />
          </>
        ) : (
          <>
            <div className="cloud-head">
              <span className={`badge ${a.status === 'error' || a.status === 'offline' ? '' : 'ok'}`}>
                {a.status === 'error' || a.status === 'offline' ? (
                  <CloudOff size={20} strokeWidth={1.75} />
                ) : a.status === 'syncing' ? (
                  <RefreshCw size={20} strokeWidth={1.75} className="spin" />
                ) : (
                  <Cloud size={20} strokeWidth={1.75} />
                )}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="cloud-title">{a.email}</div>
                <div className={`cloud-meta ${a.status === 'error' ? 'c-expense' : ''}`}>{statusText()}</div>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => a.syncNow()} disabled={a.status === 'syncing'}>
              <RefreshCw size={18} strokeWidth={1.75} />
              Sincronizar ahora
            </button>
            <button className="btn btn-danger" onClick={signOut}>
              <LogOut size={18} strokeWidth={1.75} />
              Cerrar sesión
            </button>
          </>
        )}
      </div>
    </div>
  );
}
