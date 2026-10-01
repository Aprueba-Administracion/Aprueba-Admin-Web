import { useState, useMemo, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import { makeL, fmt } from './i18n.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Commercial from './pages/Commercial.jsx';
import Sponsors from './pages/Sponsors.jsx';
import Operations from './pages/Operations.jsx';
import Users from './pages/Users.jsx';
import Tutors from './pages/Tutors.jsx';
import Content from './pages/Content.jsx';
import Plans from './pages/Plans.jsx';
import Audit from './pages/Audit.jsx';
import {
  IconDashboard, IconDollarSign, IconMegaphone, IconTool, IconUsersFilled,
  IconGraduationCap, IconBook, IconPuzzle, IconClipboardList,
} from './components/ui.jsx';

// Definición de las vistas: ruta, etiqueta, icono y roles que pueden verlas.
// Los roles replican el `requireRole` del backend para no ofrecer pantallas que
// el API rechazaría con 403 (admin siempre pasa).
// `ic` es el componente de ícono SVG relleno (fill=currentColor, no solo el
// contorno) que Layout.jsx renderiza en el sidebar — un solo color heredado,
// sin tonos distintos por vista.
export const VIEWS = [
  { id: 'resumen', path: '/', ic: IconDashboard, group: 1, roles: ['admin', 'finance', 'ops', 'support'], el: Overview },
  { id: 'comercial', path: '/comercial', ic: IconDollarSign, group: 1, roles: ['finance'], el: Commercial },
  { id: 'sponsors', path: '/sponsors', ic: IconMegaphone, group: 1, roles: ['finance'], el: Sponsors },
  { id: 'operativa', path: '/operativa', ic: IconTool, group: 2, roles: ['ops'], el: Operations },
  { id: 'usuarios', path: '/usuarios', ic: IconUsersFilled, group: 2, roles: ['support'], el: Users },
  { id: 'tutores', path: '/tutores', ic: IconGraduationCap, group: 2, roles: ['support'], el: Tutors },
  { id: 'contenido', path: '/contenido', ic: IconBook, group: 2, roles: ['admin'], el: Content },
  { id: 'planes', path: '/planes', ic: IconPuzzle, group: 2, roles: ['admin'], el: Plans },
  { id: 'auditoria', path: '/auditoria', ic: IconClipboardList, group: 2, roles: ['admin'], el: Audit },
];

export default function App() {
  const { user } = useAuth();
  const [lang, setLang] = useState('es');
  const [dark, setDark] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
  });
  const L = useMemo(() => makeL(lang), [lang]);
  const ctx = { L, lang, setLang, dark, setDark, fmt: (n) => fmt(n, lang) };

  // Única fuente de verdad para el modo oscuro: se aplica acá, tanto en <html>
  // como en <body>, así da lo mismo si el toggle se acciona desde el login o
  // desde dentro de la consola (antes cada uno tocaba el DOM por su cuenta y
  // se desincronizaban entre sí).
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.body.classList.toggle('dark', dark);
  }, [dark]);

  if (!user) return <Login ctx={ctx} />;

  return (
    <Layout ctx={ctx}>
      <Routes>
        {VIEWS.map((v) => (
          <Route key={v.id} path={v.path} element={<Guard view={v} ctx={ctx} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function Guard({ view, ctx }) {
  const { canAccess } = useAuth();
  const loc = useLocation();
  // Si el rol actual no puede ver esta ruta —típicamente porque quedó
  // apuntando a una vista de otro rol al cambiar de cuenta sin recargar la
  // página (logout + login con otro usuario, misma pestaña)— se redirige a
  // Resumen en vez de mostrar el aviso de "sin acceso": esa vista ni
  // siquiera debería quedar "abierta" para un rol que no la tiene.
  if (!canAccess(view.roles)) {
    return <Navigate to="/" replace />;
  }
  const El = view.el;
  return <El ctx={ctx} key={loc.pathname} />;
}
