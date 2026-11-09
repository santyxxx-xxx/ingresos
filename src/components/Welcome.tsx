import { AuthForm } from './AuthForm';

export function Welcome({ onSkip }: { onSkip: () => void }) {
  return (
    <>
      <div className="backdrop-art" aria-hidden="true">
        <span className="b1" />
        <span className="b2" />
        <span className="b3" />
        <span className="b4" />
      </div>
      <div className="welcome">
        <div className="welcome-inner anim-fade">
          <img src="/icons/icon-192.png" alt="" className="welcome-logo" width={72} height={72} />
          <h1>Ingresos</h1>
          <p className="welcome-sub">
            Tus gastos e ingresos, claros. Crea tu cuenta y tus datos estarán en todos tus dispositivos.
          </p>
          <div className="card glass">
            <AuthForm />
          </div>
          <button className="welcome-skip" onClick={onSkip}>
            Usar sin cuenta (solo en este dispositivo)
          </button>
        </div>
      </div>
    </>
  );
}
