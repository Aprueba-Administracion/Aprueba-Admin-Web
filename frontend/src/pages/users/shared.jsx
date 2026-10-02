export const USER_STATES = ['active', 'suspended', 'churned'];

export const STATE_TAG = { active: ['g', 'us_active'], suspended: ['w', 'us_suspended'], churned: ['d', 'us_churned'] };

export const PRI_TAG = { high: ['d', 'pri_high'], med: ['w', 'pri_med'], low: ['b', 'pri_low'] };

export const TICKET_TAG = { open: ['d', 'ts_open'], progress: ['w', 'ts_progress'], closed: ['g', 'ts_closed'] };

export const COR_TAG = { pending: ['w', 'cs_pending'], confirmed: ['g', 'cs_confirmed'], rejected: ['d', 'cs_rejected'] };

export const TICKET_CATEGORIES = ['account', 'payments', 'content', 'login', 'other'];

export const REASON_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'incorrect_answer', label: 'Respuesta incorrecta' },
  { value: 'typo', label: 'Error de tipeo' },
  { value: 'ambiguous_statement', label: 'Enunciado ambiguo' },
  { value: 'poor_explanation', label: 'Explicación deficiente' },
  { value: 'incomplete_answer', label: 'Respuesta incompleta' },
];

export const CONFIRM_REWARD = 250;

export const FALLBACK_PLANS = [{ id: 'free', name: 'Gratis' }, { id: 'uni', name: '1 prueba' }, { id: 'all', name: 'Todas' }];

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
