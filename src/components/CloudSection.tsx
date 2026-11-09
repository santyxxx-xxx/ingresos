import { useEffect, useState } from 'react';
import { Cloud, CloudOff, CloudUpload, CloudDownload, LogOut, Mail, RefreshCw } from 'lucide-react';
import { timeAgo, useCloud } from '../lib/cloud';
import { useFeedback } from './Feedback';
import { haptic } from '../lib/utils';

export function CloudSection({ onDone }: { onDone?: () => void }) {
  const cloud = useCloud();
  const { confirm, toast } = useFeedback();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (cloud.session) {
      setStep('email');
      setCode('');
      setErr('');
    }
  }, [cloud.session]);

  if (!cloud.enabled) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
      haptic([20, 40, 20]);
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      const e = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(e)) throw new Error('Escribe un correo válido.');
      await cloud.sendCode(e);
      setEmail(e);
      setStep('code');
      toast('Código enviado a tu correo');
    });

  const verify = () =>
    run(async () => {
      const c = code.replace(/\D/g, '');
      if (c.length < 6) throw new Error('El código tiene 6 dígitos o más.');
      await cloud.verifyCode(email, c);
      haptic(15);
      toast('Sesión iniciada');
    });

  const restore = async () => {
    if (!cloud.info) return;
    const ok = await confirm({
      title: 'Restaurar desde la nube',
      message: `Se cargará el respaldo del ${new Date(cloud.info.updatedAt).toLocaleString('es-EC', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })} con ${cloud.info.txCount} movimientos. Reemplazará los datos actuales de este dispositivo.`,
      confirmLabel: 'Restaurar',
      danger: true
    });
    if (!ok) return;
    await run(async () => {
      const n = await cloud.restoreFromCloud();
      haptic(15);
      toast(`Restaurados ${n} movimientos`);
      onDone?.();
    });
  };

  const backup = async () => {
    // Evita pisar un respaldo más grande desde un dispositivo nuevo sin restaurar
    if (!cloud.linked && cloud.info && cloud.info.txCount > 0) {
      const ok = await confirm({
        title: 'Ya tienes un respaldo',
        message: `En la nube hay un respaldo con ${cloud.info.txCount} movimientos. Si respaldas ahora, se reemplazará por los datos de este dispositivo. ¿Prefieres restaurarlo primero?`,
        confirmLabel: 'Reemplazar igual',
        danger: true
      });
      if (!ok) return;
    }
    await run(async () => {
      await cloud.backupNow();
      haptic(15);
      toast('Respaldado en la nube');
    });
  };

  const signOut = async () => {
    const ok = await confirm({
      title: 'Cerrar sesión',
      message: 'Tus datos se quedan en este dispositivo, pero dejarán de respaldarse en la nube hasta que vuelvas a entrar.',
      confirmLabel: 'Cerrar sesión'
    });
    if (ok) await cloud.signOut();
  };

  return (
    <div>
      <span className="field-label">Respaldo en la nube</span>
      <div className="cloud-card glass">
        {!cloud.session ? (
          step === 'email' ? (
            <>
              <div className="cloud-head">
                <span className="badge">
                  <Cloud size={20} strokeWidth={1.75} />
                </span>
                <p>Entra con tu correo y tus datos se respaldarán solos. Si pierdes o cambias de celular, los recuperas.</p>
              </div>
              <input
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <button className="btn btn-primary" onClick={send} disabled={busy}>
                <Mail size={19} strokeWidth={1.75} />
                {busy ? 'Enviando…' : 'Enviarme un código'}
              </button>
            </>
          ) : (
            <>
              <p className="confirm-text">
                Te enviamos un código a <b>{email}</b>. Escríbelo aquí (revisa también spam).
              </p>
              <input
                className="input code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
              />
              <button className="btn btn-primary" onClick={verify} disabled={busy}>
                {busy ? 'Verificando…' : 'Entrar'}
              </button>
              <div className="btn-row">
                <button className="btn btn-ghost small" onClick={() => setStep('email')}>
                  Cambiar correo
                </button>
                <button className="btn btn-ghost small" onClick={send} disabled={busy}>
                  Reenviar
                </button>
              </div>
            </>
          )
        ) : (
          <>
            <div className="cloud-head">
              <span className={`badge ${cloud.linked ? 'ok' : ''}`}>
                {cloud.status === 'offline' || cloud.status === 'error' ? (
                  <CloudOff size={20} strokeWidth={1.75} />
                ) : cloud.status === 'saving' ? (
                  <RefreshCw size={20} strokeWidth={1.75} className="spin" />
                ) : (
                  <Cloud size={20} strokeWidth={1.75} />
                )}
              </span>
              <div>
                <div className="cloud-title">{cloud.email}</div>
                <div className="cloud-meta">
                  {cloud.status === 'saving'
                    ? 'Respaldando…'
                    : cloud.status === 'offline'
                      ? 'Sin conexión · se respaldará al volver el internet'
                      : cloud.info === undefined
                        ? 'Consultando…'
                        : cloud.info === null
                          ? 'Aún no tienes respaldo'
                          : `Último respaldo ${timeAgo(cloud.info.updatedAt)} · ${cloud.info.txCount} mov.${
                              cloud.info.device ? ` · ${cloud.info.device}` : ''
                            }`}
                </div>
                {cloud.linked && <div className="cloud-auto">Respaldo automático activado</div>}
              </div>
            </div>

            {!cloud.linked && cloud.info && cloud.info.txCount > 0 && (
              <button className="btn btn-primary" onClick={restore} disabled={busy}>
                <CloudDownload size={19} strokeWidth={1.75} />
                Restaurar mi respaldo
              </button>
            )}
            <button className={`btn ${!cloud.linked && !(cloud.info && cloud.info.txCount > 0) ? 'btn-primary' : 'btn-ghost'}`} onClick={backup} disabled={busy}>
              <CloudUpload size={19} strokeWidth={1.75} />
              {cloud.linked ? 'Respaldar ahora' : 'Activar respaldo automático'}
            </button>
            {cloud.linked && cloud.info && (
              <button className="btn btn-ghost" onClick={restore} disabled={busy}>
                <CloudDownload size={19} strokeWidth={1.75} />
                Restaurar desde la nube
              </button>
            )}
            <button className="btn btn-danger" onClick={signOut}>
              <LogOut size={18} strokeWidth={1.75} />
              Cerrar sesión
            </button>
          </>
        )}
        {(err || (cloud.session && cloud.error)) && <p className="error-text" style={{ marginTop: 0 }}>{err || cloud.error}</p>}
      </div>
    </div>
  );
}
