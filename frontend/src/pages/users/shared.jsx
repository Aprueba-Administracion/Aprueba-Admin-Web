export const USER_STATES = ['active', 'suspended', 'churned'];

export const STATE_TAG = { active: ['g', 'us_active'], suspended: ['w', 'us_suspended'], churned: ['d', 'us_churned'] };

export const PRI_TAG = { high: ['d', 'pri_high'], med: ['w', 'pri_med'], low: ['b', 'pri_low'] };

export const TICKET_TAG = { open: ['d', 'ts_open'], progress: ['w', 'ts_progress'], closed: ['g', 'ts_closed'] };

export const COR_TAG = { pending: ['w', 'cs_pending'], confirmed: ['g', 'cs_confirmed'], rejected: ['d', 'cs_rejected'] };

export const TICKET_CATEGORIES = ['account', 'payments', 'content', 'login', 'other'];

// Valores reales de `corrections.reason` en el backend (ver seed). Las etiquetas
// salen de i18n (`reason_<valor>`).
export const REASON_KEYS = ['wrong_answer', 'ambiguous', 'typo', 'bad_explanation', 'other'];

export const CONFIRM_REWARD = 250;

export const FALLBACK_PLANS = [
  { id: 'free', name: { es: 'Gratis', en: 'Free' } },
  { id: 'uni', name: { es: '1 prueba ilimitada', en: '1 test unlimited' } },
  { id: 'all', name: { es: 'Todas las pruebas', en: 'All tests' } },
];

// Los planes de sistema existen desde antes de que el nombre fuera bilingüe.
// Este mapa evita que una ficha antigua que sólo tenga el nombre en español
// bloquee el cambio de idioma en la interfaz.
export const SYSTEM_PLAN_NAMES = Object.fromEntries(FALLBACK_PLANS.map((p) => [p.id, p.name]));

// Modelo canónico: plan.name = { es, en } y plan.price = { monthly, yearly }.
// Estos helpers también toleran el formato anterior (string / número).
export const planLabel = (p, lang = 'es') => {
  const systemName = SYSTEM_PLAN_NAMES[p?.id];
  // Estos tres identificadores son fijos. Se prioriza su catálogo canónico
  // porque hay registros históricos cuyo campo `name.en` fue almacenado con
  // el texto en español.
  if (systemName) return systemName[lang] || systemName.es;
  if (p?.name && typeof p.name === 'object') {
    return p.name[lang] || p.name.es || p.name.en || p.id || '';
  }
  // Los datos previos usaban `name` como string y, por tanto, no tienen una
  // alternativa en inglés. Sólo se traduce el catálogo fijo; los planes
  // creados por una persona conservan su nombre original.
  return p?.name || p?.id || '';
};

export const planMonthly = (p) => Number(p?.price && typeof p.price === 'object' ? p.price.monthly : p?.price) || 0;

export const FALLBACK_AGENTS = [{ id: 'adm_1', name: 'Admin General', role: 'admin' }, { id: 'adm_4', name: 'Soporte', role: 'support' }];

export const PAGE_SIZE = 20;

export const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const tr = (L, key, fallback) => {
  const val = L?.(key);
  return val && val !== key ? val : fallback;
};

export const cleanText = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,:;'"()\-–—_+*/\\=[\]{}#]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const formatDateTime = (dateStr, lang = 'es') => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateOnly = (dateStr, lang = 'es') => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US');
};

// País del usuario: pin + nombre del país y, debajo, "Ciudad (CÓDIGO)".
// `code` es el ISO 3166-1 alfa-2 que guarda el backend en users.country.
// El modelo no guarda ciudad; si la ficha trae `city` se muestra, si no
// sólo el código.
export const countryName = (code, lang = 'es') => {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(String(code).toUpperCase()) || code;
  } catch {
    return code;
  }
};

const PIN_COLORS = { CL: '#1d4ed8', PE: '#dc2626' };

const SvgPin = ({ color, size = 18 }) => (
  <svg width={size} height={size} style={{ flexShrink: 0 }} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
  </svg>
);

export function CountryCell({ code, city, lang = 'es', compact = false, inline = false }) {
  const cc = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const color = PIN_COLORS[cc] || 'var(--brand)';
  if (inline) {
    return (
      <span className="note" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <SvgPin color={color} size={14} />
        <span>{countryName(cc, lang)}{city ? ` · ${city}` : ''} ({cc})</span>
      </span>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <SvgPin color={color} />
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ fontWeight: 700, fontSize: compact ? 13 : 14 }}>{countryName(cc, lang)}</div>
        <div className="note" style={{ fontSize: 11.5 }}>{city ? `${city} (${cc})` : cc}</div>
      </div>
    </div>
  );
}

export const SvgSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const SvgEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export const SvgCreditCard = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

export const SvgClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

export const SvgAward = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);

export const SvgCalendar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
