// Iconos de línea de "Planes y productos" (reemplazan los emojis).
// Estilo Lucide: 24×24, trazo 2, redondeado, color = currentColor.
import { planMonthly } from '../users/shared.jsx';

const Svg = ({ size = 18, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);

// ── Funcionalidades ──
const InfinityI = (p) => <Svg {...p}><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" /></Svg>;
const FileText = (p) => <Svg {...p}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></Svg>;
const BookOpen = (p) => <Svg {...p}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></Svg>;
const Flag = (p) => <Svg {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></Svg>;
const Users = (p) => <Svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>;
const BarChart = (p) => <Svg {...p}><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></Svg>;
const Gift = (p) => <Svg {...p}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></Svg>;
const Ban = (p) => <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></Svg>;
const Download = (p) => <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Svg>;
const Star = (p) => <Svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Svg>;
const Sparkles = (p) => <Svg {...p}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></Svg>;

// key estable de la función (modelo de Max) → ícono + tono de color.
const FEATURE_ICONS = {
  unlimited_questions: [InfinityI, 'blue'],
  mock_mode: [FileText, 'rose'],
  explanations: [BookOpen, 'blue'],
  corrections: [Flag, 'ink'],
  study_groups: [Users, 'purple'],
  advanced_stats: [BarChart, 'green'],
  sponsor_benefits: [Gift, 'orange'],
  no_ads: [Ban, 'red'],
  offline: [Download, 'blue'],
  priority_support: [Star, 'amber'],
};

export function FeatureIcon({ feature, size = 16 }) {
  const [Ico, tone] = FEATURE_ICONS[feature?.key] || [Sparkles, 'ink'];
  return <span className={`pi tone-${tone}`}><Ico size={size} /></span>;
}

// ── Planes ──
const Layers = (p) => <Svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></Svg>;
const Crown = (p) => <Svg {...p}><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" /></Svg>;
const Zap = (p) => <Svg {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></Svg>;
const PLAN_ICONS = { gift: Gift, layers: Layers, crown: Crown, zap: Zap };

// El ícono se elige solo (no hay campo en el modelo de Max):
//  · plan gratuito                         → regalo
//  · planes de sistema por id (uni / all)  → capas / corona
//  · planes propios de pago, por precio:   → el más barato capas, el más caro corona, el resto rayo
export function planIconKey(plan, plans) {
  const price = planMonthly(plan);
  if (price === 0) return 'gift';
  if (plan.id === 'uni') return 'layers';
  if (plan.id === 'all') return 'crown';
  const paid = plans.filter((x) => planMonthly(x) > 0).map((x) => planMonthly(x)).sort((a, b) => a - b);
  if (paid.length < 2) return 'layers';
  if (price <= paid[0]) return 'layers';
  if (price >= paid[paid.length - 1]) return 'crown';
  return 'zap';
}

export function PlanIcon({ name, size = 22 }) {
  const Ico = PLAN_ICONS[name] || Gift;
  return <Ico size={size} />;
}

// ── Utilidades de la pantalla ──
export const IconMore = ({ size = 18 }) => <Svg size={size}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></Svg>;
export const IconX = ({ size = 14 }) => <Svg size={size}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>;
export const IconCheck = ({ size = 14 }) => <Svg size={size}><polyline points="20 6 9 17 4 12" /></Svg>;
export const IconPlus = ({ size = 14 }) => <Svg size={size}><path d="M5 12h14" /><path d="M12 5v14" /></Svg>;
export const IconMedal = ({ size = 14 }) => <Svg size={size}><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" /><path d="M11 12 5.12 2.2" /><path d="m13 12 5.88-9.8" /><path d="M8 7h8" /><circle cx="12" cy="17" r="5" /><path d="M12 18v-2h-.5" /></Svg>;
