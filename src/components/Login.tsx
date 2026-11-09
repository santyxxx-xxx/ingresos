import { AuthForm, GoogleButton } from './AuthForm';

// El botón de Google aparece solo si en Vercel se define VITE_ENABLE_GOOGLE=true
// (después de activar Google en Supabase → Authentication → Providers).
const GOOGLE_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE === 'true';

export function Login() {
  return (
    <>
      <div className="backdrop-art" aria-hidden="true">
        <span className="b1" />
        <span className="b2" />
        <span className="b3" />
      </div>
      <div className="welcome">
        <div className="welcome-inner anim-fade">
          <img src="/icons/icon-192.png" alt="" className="welcome-logo" width={72} height={72} />
          <h1>Ingresos</h1>
          <p className="welcome-sub">Tus gastos e ingresos en orden, desde cualquier dispositivo.</p>
          <div className="card glass auth-card">
            {GOOGLE_ENABLED && (
              <>
                <GoogleButton />
                <div className="divider">
                  <span>o con tu correo</span>
                </div>
              </>
            )}
            <AuthForm />
          </div>
        </div>
      </div>
    </>
  );
}
