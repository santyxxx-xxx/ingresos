import { useState } from 'react';
import { CloudUpload, X } from 'lucide-react';
import { useAccount } from '../lib/account';

/** Para quien eligió usar la app sin cuenta: invita a crearla */
export function AccountBanner({ onOpen }: { onOpen: () => void }) {
  const a = useAccount();
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem('account-banner-hidden') === '1';
    } catch {
      return false;
    }
  });
  if (!a.enabled || !a.ready || a.session || hidden) return null;

  return (
    <div className="cloud-banner glass">
      <button className="cloud-banner-main" onClick={onOpen}>
        <span className="badge ok">
          <CloudUpload size={19} strokeWidth={1.75} />
        </span>
        <span>Crea tu cuenta para no perder tus datos y tenerlos en todos tus dispositivos.</span>
      </button>
      <button
        className="icon-btn"
        aria-label="Ocultar"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem('account-banner-hidden', '1');
          } catch {
            /* noop */
          }
        }}
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
