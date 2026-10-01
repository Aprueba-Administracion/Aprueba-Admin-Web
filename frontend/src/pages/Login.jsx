import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { IconGlobeFilled, IconSunFilled, IconMoonFilled, IconEye, IconEyeOff } from '../components/ui.jsx';

export default function Login({ ctx }) {
  // dark/setDark viven en App.jsx (única fuente de verdad: un solo useEffect
  // ahí aplica la clase .dark tanto en <html> como en <body>). Antes este
  // componente tenía su propio estado local `isDark` que solo tocaba el DOM
  // mientras el login estaba montado; al iniciar sesión, el toggle de la
  // consola (Layout.jsx) solo sacaba la clase de <body> y no de <html>, así
  // que el modo oscuro activado acá quedaba "pegado" después de loguearse.
  const { L, lang, setLang, dark, setDark } = ctx;
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password, otp || undefined);
      // Sin esto, si la sesión se cerró (o expiró) estando en otra vista, el
      // navegador seguía apuntando a esa URL (p. ej. /usuarios) y al volver a
      // loguearse quedaba ahí mismo en vez de partir en Resumen.
      navigate('/', { replace: true });
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
            <div className="pw-wrap">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
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
            className="ctl ctl-icon"
            style={{ gap: 6 }}
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          >
            <IconGlobeFilled size={13} /> {lang === 'es' ? 'EN' : 'ES'}
          </button>
          <button
            type="button"
            className="ctl ctl-icon"
            style={{ gap: 6 }}
            onClick={() => setDark(!dark)}
          >
            {dark ? <IconSunFilled size={15} /> : <IconMoonFilled size={14} />} {dark ? 'Claro' : 'Oscuro'}
          </button>
        </div>
      </div>
    </div>
  );
}