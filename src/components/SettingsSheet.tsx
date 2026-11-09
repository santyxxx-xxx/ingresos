import { useRef } from 'react';
import { Download, Upload, ShieldCheck } from 'lucide-react';
import { Sheet } from './Sheet';
import { AccountSection } from './AccountSection';
import { useFeedback } from './Feedback';
import { exportBackup, parseBackup, restoreBackup } from '../lib/backup';
import { useData } from '../lib/data';
import { haptic } from '../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsSheet({ open, onClose }: Props) {
  const { confirm, toast } = useFeedback();
  const { uid, refresh } = useData();
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    try {
      const r = await exportBackup(uid);
      haptic(15);
      toast(r === 'shared' ? 'Copia lista' : 'Copia descargada');
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') toast((e as Error).message || 'No se pudo exportar', 'error');
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await parseBackup(file);
      const ok = await confirm({
        title: 'Importar copia',
        message: `El archivo tiene ${data.transactions.length} movimientos y ${data.categories.length} categorías. Reemplazará todos los datos de tu cuenta.`,
        confirmLabel: 'Importar',
        danger: true
      });
      if (!ok) return;
      await restoreBackup(uid, data);
      refresh();
      haptic(15);
      toast('Copia importada');
      onClose();
    } catch (e) {
      await confirm({
        title: 'No se pudo importar',
        message: (e as Error).message || 'El archivo no es válido.',
        confirmLabel: 'Entendido'
      });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Ajustes">
      <AccountSection />

      <div>
        <span className="field-label">Copia en archivo</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-ghost" onClick={doExport}>
            <Download size={19} strokeWidth={1.75} />
            Descargar mis datos (JSON)
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={19} strokeWidth={1.75} />
            Importar una copia
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </div>

      <p className="note" style={{ display: 'flex', gap: 8 }}>
        <ShieldCheck size={16} strokeWidth={1.75} style={{ flex: 'none', marginTop: 2 }} />
        Tus datos viven en tu cuenta y solo tú puedes verlos. La copia en archivo es un respaldo extra que puedes
        guardar donde quieras.
      </p>
    </Sheet>
  );
}
