import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Login({ ctx }) {
  // dark/setDark viven en App.jsx (única fuente de verdad: un solo useEffect
  // ahí aplica la clase .dark tanto en <html> como en <body>). Antes este
  // componente tenía su propio estado local `isDark` que solo tocaba el DOM
  // mientras el login estaba montado; al iniciar sesión, el toggle de la
  // consola (Layout.jsx) solo sacaba la clase de <body> y no de <html>, así
  // que el modo oscuro activado acá quedaba "pegado" después de loguearse.
  const { L, lang, setLang, dark, setDark } = ctx;
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password, otp || undefined);
    } catch (e2) {
      setErr(e2.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="lg">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <polygon points="3,27 9,6 13,6 8,27" fill="var(--brand)" />
            <polygon points="27,27 21,6 17,6 22,27" fill="var(--brand)" />
            <rect x="7" y="14" width="16" height="4" rx="1" fill="var(--brand)" />
            <rect x="12" y="14" width="6" height="10" rx="1" fill="var(--cta)" />
            <polygon points="15,5 12,10 18,10" fill="var(--cta)" />
          </svg>
          Aprueba
        </div>
        <p className="sub" style={{ textAlign: 'center' }}>{L('login_title')}</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>{L('login_email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="field">
          <label>{L('login_pass')}</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: 36, width: '100%' }}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              title={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
              style={{
                position: 'absolute',
                right: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--muted, #64748b)',
                padding: 4,
              }}
            >
              {showPass ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>
          <div className="field">
            <label>{L('login_otp')}</label>
            <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" />
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn" style={{ width: '100%', marginTop: 16 }} disabled={busy}>
            {busy ? '…' : L('login_btn')}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
          <button
            type="button"
            className="ctl"
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          >
            🌐 {lang === 'es' ? 'EN' : 'ES'}
          </button>
          <button
            type="button"
            className="ctl"
            onClick={() => setDark(!dark)}
          >
            {dark ? '☀️ Claro' : '🌙 Oscuro'}
          </button>
        </div>
      </div>
    </div>
  );
}