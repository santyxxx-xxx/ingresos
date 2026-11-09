import { useState } from 'react';
import { CloudUpload, X } from 'lucide-react';
import { useCloud } from '../lib/cloud';

/** Invita a activar el respaldo o a restaurar en un dispositivo nuevo */
export function CloudBanner({ onOpen }: { onOpen: () => void }) {
  const cloud = useCloud();
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem('cloud-banner-hidden') === '1';
    } catch {
      return false;
    }
  });
  if (!cloud.enabled || !cloud.ready || cloud.linked || hidden) return null;

  const canRestore = !!cloud.session && !!cloud.info && cloud.info.txCount > 0;
  const text = canRestore
    ? `Tienes un respaldo en la nube con ${cloud.info!.txCount} movimientos. Tócalo para restaurarlo.`
    : 'Activa el respaldo en la nube para no perder tus datos si cambias o pierdes el celular.';

  return (
    <div className="cloud-banner glass">
      <button className="cloud-banner-main" onClick={onOpen}>
        <span className="badge ok">
          <CloudUpload size={19} strokeWidth={1.75} />
        </span>
        <span>{text}</span>
      </button>
      <button
        className="icon-btn"
        aria-label="Ocultar"
        onClick={() => {
          setHidden(true);
          try {
            sessionStorage.setItem('cloud-banner-hidden', '1');
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
