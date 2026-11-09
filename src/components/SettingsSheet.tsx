import { useRef } from 'react';
import { Download, Upload, ShieldCheck } from 'lucide-react';
import { Sheet } from './Sheet';
import { Segmented } from './Segmented';
import { useFeedback } from './Feedback';
import { exportBackup, parseBackup, restoreBackup } from '../lib/backup';
import type { ThemePref } from '../lib/hooks';
import { haptic } from '../lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
}

export function SettingsSheet({ open, onClose, theme, setTheme }: Props) {
  const { confirm, toast } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    try {
      const r = await exportBackup();
      haptic(15);
      toast(r === 'shared' ? 'Respaldo listo' : 'Respaldo descargado');
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') toast('No se pudo exportar');
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await parseBackup(file);
      const ok = await confirm({
        title: 'Importar respaldo',
        message: `El archivo tiene ${data.transactions.length} movimientos y ${data.categories.length} categorías. Reemplazará todos los datos actuales de este dispositivo.`,
        confirmLabel: 'Importar',
        danger: true
      });
      if (!ok) return;
      await restoreBackup(data);
      haptic(15);
      toast('Respaldo importado');
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
      <div>
        <span className="field-label">Apariencia</span>
        <Segmented
          value={theme}
          onChange={(t) => {
            haptic(6);
            setTheme(t);
          }}
          options={[
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Oscuro' },
            { value: 'system', label: 'Auto' }
          ]}
        />
      </div>

      <div>
        <span className="field-label">Respaldo</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-ghost" onClick={doExport}>
            <Download size={19} strokeWidth={1.75} />
            Exportar datos (JSON)
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={19} strokeWidth={1.75} />
            Importar respaldo
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
        Tus datos se guardan solo en este dispositivo, sin cuentas ni servidores. Exporta un respaldo de vez en
        cuando para no perderlos si cambias de celular o borras los datos del navegador.
      </p>
    </Sheet>
  );
}
