import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Login({ ctx }) {
  const { L, lang, setLang, dark, setDark: ctxSetDark } = ctx;
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  // Estado puramente en memoria, inicializado según el DOM o ctx
  const [isDark, setIsDark] = useState(() => {
    if (typeof dark === 'boolean') return dark;
    if (typeof document !== 'undefined') {
      return (
        document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark')
      );
    }
    return false;
  });

  // Aplica o quita la clase .dark solo en tiempo de ejecución en el DOM
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    if (typeof ctxSetDark === 'function') {
      ctxSetDark(isDark);
    }
  }, [isDark, ctxSetDark]);

  const toggleDark = () => {
    setIsDark((prev) => !prev);
  };

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
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
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
            onClick={toggleDark}
          >
            {isDark ? '☀️ Claro' : '🌙 Oscuro'}
          </button>
        </div>
      </div>
    </div>
  );
}