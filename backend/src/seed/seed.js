// Siembra Firestore (real o emulador) con los datos del wireframe / doc de API.
// Uso:  npm run seed:emu   (emulador, recomendado)  |  npm run seed -- --real  (Firestore real, gasta cuota)
// Sin FIRESTORE_EMULATOR_HOST y sin --real el script se detiene (ver lib/envGuard.js).
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, COL } from '../data/repo.js';
import { assertSafeTarget } from '../lib/envGuard.js';
import { writeSyntheticMetrics } from '../lib/syntheticMetrics.js';

const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);

// adminUsers al pie de la ficha de Max (sección 4): emailLower, active,
// failedLoginCount, lockedUntil, lastLoginAt, mfaSecret y createdAt/updatedAt.
// bcrypt coste 12 (el documento lo fija). mfaSecret queda en null: el TOTP
// cifrado con KMS no aplica aún, el MFA sigue siendo el OTP de demostración.
const SEED_NOW = new Date();
const mkAdmin = (id, name, email, role, mfaEnabled, password) => ({
  id, name, email, emailLower: email.toLowerCase(), passwordHash: bcrypt.hashSync(password, 12),
  role, mfaEnabled, mfaSecret: null, active: true,
  failedLoginCount: 0, lockedUntil: null, lastLoginAt: null,
  createdAt: SEED_NOW, updatedAt: SEED_NOW,
});
const adminUsers = [
  mkAdmin('adm_1', 'Admin General', 'admin@aprueba.cl', 'admin', true, 'admin123'),
  mkAdmin('adm_2', 'Finanzas', 'finance@aprueba.cl', 'finance', true, 'finance123'),
  mkAdmin('adm_3', 'Operaciones', 'ops@aprueba.cl', 'ops', false, 'ops123'),
  mkAdmin('adm_4', 'Soporte', 'support@aprueba.cl', 'support', false, 'support123'),
];

// features/{fN} al pie de la ficha de Max (sección 5): key estable, name {es,en},
// description (null), icon (emoji), order (1–10) y active.
const FEATURE_ROWS = [
  ['f1', 'unlimited_questions', '♾️', 'Preguntas ilimitadas', 'Unlimited questions'],
  ['f2', 'mock_mode', '📝', 'Modo facsímil (ensayos)', 'Facsimile mode (mocks)'],
  ['f3', 'explanations', '📖', 'Explicaciones paso a paso', 'Step-by-step explanations'],
  ['f4', 'corrections', '⚑', 'Recorrección de preguntas', 'Question correction requests'],
  ['f5', 'study_groups', '👥', 'Grupos de estudio', 'Study groups'],
  ['f6', 'advanced_stats', '📊', 'Estadísticas avanzadas', 'Advanced stats'],
  ['f7', 'sponsor_benefits', '🎁', 'Beneficios de sponsors', 'Sponsor benefits'],
  ['f8', 'no_ads', '🚫', 'Sin anuncios', 'No ads'],
  ['f9', 'offline', '⬇️', 'Descarga offline', 'Offline download'],
  ['f10', 'priority_support', '⭐', 'Soporte prioritario', 'Priority support'],
];
const features = FEATURE_ROWS.map(([id, key, icon, es, en], i) => ({
  id, key, name: { es, en }, description: null, icon, order: i + 1, active: true,
}));

// plans/{planId} al pie de la ficha de Max (sección 4.x): name {es,en}, nameLower,
// nameKey, price {monthly,yearly}, currency, system, published/popular/order,
// stripeProductId/stripePriceIds (null: aún sin Stripe) y createdAt/updatedAt.
// `yearly` lo gestiona la app del alumno; se siembran los valores del ejemplo de Max.
const mkPlan = (id, order, es, en, nameKey, monthly, yearly, color, feats, limits, badges, popular) => ({
  id, name: { es, en }, nameLower: es.toLowerCase(), nameKey,
  price: { monthly, yearly }, currency: 'USD', color, features: feats, limits, badges,
  system: true, published: true, popular, order,
  stripeProductId: null, stripePriceIds: { monthly: null, yearly: null },
  createdAt: SEED_NOW, updatedAt: SEED_NOW, createdBy: null, updatedBy: null,
});
const plans = [
  mkPlan('free', 1, 'Gratis', 'Free', 'pl_free', 0, null, '#64748B', ['f3'], { qDay: 20, groups: 1, tests: 1 }, { login: 1, purchase: 0, correct: 1 }, false),
  mkPlan('uni', 2, '1 prueba ilimitada', '1 test unlimited', 'pl_uni', 1, 10, '#1A365D', ['f1', 'f3', 'f4'], { qDay: 0, groups: 3, tests: 1 }, { login: 1, purchase: 5, correct: 1 }, false),
  mkPlan('all', 3, 'Todas las pruebas', 'All tests', 'pl_all', 5, 48, '#F5B041', ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'], { qDay: 0, groups: 0, tests: 99 }, { login: 2, purchase: 10, correct: 2 }, true),
];

// Campos canónicos de sponsors (modelo de Max, Fase 1): búsqueda case-insensitive,
// contacto, borrado lógico y trazabilidad. nameLower se calcula abajo.
const SPONSOR_CANON = { contactEmail: null, deletedAt: null, createdBy: 'seed', updatedBy: 'seed' };
const sponsors = [
  { id: 'spo_1', name: 'Preuniversitario Pedro de V.', tier: 'Gold', monthlyFee: 3200, benefitsOffered: 4, benefitsRedeemed: 640, status: 'ok', ...SPONSOR_CANON },
  { id: 'spo_2', name: 'Librería Antártica', tier: 'Silver', monthlyFee: 1800, benefitsOffered: 2, benefitsRedeemed: 410, status: 'ok', ...SPONSOR_CANON },
  { id: 'spo_3', name: 'Banco Estudiantil', tier: 'Gold', monthlyFee: 2400, benefitsOffered: 3, benefitsRedeemed: 520, status: 'ok', ...SPONSOR_CANON },
  { id: 'spo_4', name: 'Café Cultura', tier: 'Bronze', monthlyFee: 900, benefitsOffered: 1, benefitsRedeemed: 180, status: 'deg', ...SPONSOR_CANON },
  { id: 'spo_5', name: 'EdiTextos PAES', tier: 'Silver', monthlyFee: 1300, benefitsOffered: 2, benefitsRedeemed: 170, status: 'ok', ...SPONSOR_CANON },
];
for (const sp of sponsors) sp.nameLower = sp.name.toLowerCase();

// Beneficios: colección raíz `benefits` (ids fijos bnf_seedNN => el seed es idempotente).
// Por sponsor se reparten sus `benefitsOffered` beneficios y sus canjes acumulados.
const BENEFIT_NAMES = {
  spo_1: ['Clase de prueba gratis', '10% en cursos PAES', 'Ensayo presencial', 'Asesoría vocacional'],
  spo_2: ['15% en libros', 'Cuaderno de regalo'],
  spo_3: ['Cuenta estudiantil sin costo', 'Tarjeta sin mantención', 'Descuento en seguros'],
  spo_4: ['Café gratis'],
  spo_5: ['Guía PAES digital', '20% en textos'],
};
const benefits = [];
let bn = 0;
for (const sp of sponsors) {
  const names = BENEFIT_NAMES[sp.id] || [];
  names.forEach((name, i) => {
    bn += 1;
    const redeemedCount = Math.floor(sp.benefitsRedeemed / names.length) + (i === 0 ? sp.benefitsRedeemed % names.length : 0);
    benefits.push({
      id: `bnf_seed${String(bn).padStart(4, '0')}`,
      sponsorId: sp.id, sponsorName: sp.name, name,
      description: null, icon: null,
      costPlatinum: 50 * (i + 1), stock: 100 + 20 * i, redeemedCount,
      active: true, expiresAt: null,
      createdAt: daysAgo(30), updatedAt: daysAgo(30),
    });
  });
}

// users/{uid} al pie de la letra del modelo canónico de Max (modelo.txt):
// se agregan nameLower/emailLower, authProvider, planStatus/planSource,
// stateChangedAt/suspension/sessionsRevokedAt, pendingEmail, streak,
// lastActiveDate/lastActiveAt (el rótulo "hoy/ayer/N d" YA NO se guarda,
// se calcula en el backend igual que `age` en tickets — ver withActivity()
// en routes/users.js), medals/badgesTotal (reemplaza el `badges` plano),
// lastAdminAction (reemplaza los campos sueltos auditedBy/auditedAt/
// lastActionReason que se usaban antes) y createdAt/updatedAt.
// Se descartan `subscription` y `groups`: no están en la tabla de campos
// de users/{uid} del documento (las suscripciones son su propia colección,
// fuera de alcance por ahora; ver MODELO_CAMBIOS.md).
const usersRaw = [
  {
    id: 'usr_1', name: 'Camila Rojas', email: 'camila@correo.cl', authProvider: 'google', country: 'CL',
    plan: 'all', planStatus: 'active', planSource: 'subscription', state: 'active',
    streak: 23, lastActiveAt: hoursAgo(1), badgesBronze: 412, stripeCustomerId: 'cus_QaBcDeFgHi',
    createdAt: daysAgo(220),
  },
  {
    id: 'usr_2', name: 'Juan López', email: 'juan@correo.cl', authProvider: 'password', country: 'CL',
    plan: 'uni', planStatus: 'active', planSource: 'subscription', state: 'active',
    streak: 9, lastActiveAt: hoursAgo(3), badgesBronze: 188, stripeCustomerId: 'cus_JlKmNoPqRs',
    pendingEmail: 'juan.nuevo@correo.cl', createdAt: daysAgo(150),
  },
  {
    id: 'usr_3', name: 'Andrea Muñoz', email: 'andrea@correo.cl', authProvider: 'password', country: 'CL',
    plan: 'free', planStatus: 'none', planSource: 'free', state: 'active',
    streak: 2, lastActiveAt: daysAgo(1), badgesBronze: 54, createdAt: daysAgo(80),
  },
  {
    id: 'usr_4', name: 'Tomás Gana', email: 'tomas@correo.cl', authProvider: 'apple', country: 'PE',
    plan: 'free', planStatus: 'none', planSource: 'free', state: 'suspended',
    streak: 0, lastActiveAt: daysAgo(120), badgesBronze: 31, createdAt: daysAgo(200),
    stateChangedAt: daysAgo(5),
    suspension: { reason: 'Reporte de fraude en recorrecciones', by: 'adm_1', at: daysAgo(5) },
    sessionsRevokedAt: daysAgo(5),
    lastAdminAction: { action: 'suspend', reason: 'Reporte de fraude en recorrecciones', by: 'adm_1', at: daysAgo(5) },
  },
  {
    id: 'usr_5', name: 'María Vidal', email: 'maria@correo.cl', authProvider: 'google', country: 'CL',
    plan: 'all', planStatus: 'active', planSource: 'subscription', state: 'active',
    streak: 15, lastActiveAt: hoursAgo(2), badgesBronze: 276, stripeCustomerId: 'cus_MvNbXcVbNm',
    createdAt: daysAgo(300),
  },
  {
    id: 'usr_6', name: 'Diego Soto', email: 'diego@correo.cl', authProvider: 'password', country: 'CL',
    plan: 'uni', planStatus: 'canceled', planSource: 'subscription', state: 'churned',
    streak: 0, lastActiveAt: daysAgo(179), badgesBronze: 140, createdAt: daysAgo(400),
    stateChangedAt: daysAgo(179),
  },
];

const users = usersRaw.map(({ badgesBronze, ...u }) => ({
  ...u,
  nameLower: u.name.toLowerCase(),
  emailLower: u.email.toLowerCase(),
  stateChangedAt: u.stateChangedAt ?? null,
  suspension: u.suspension ?? null,
  sessionsRevokedAt: u.sessionsRevokedAt ?? null,
  pendingEmail: u.pendingEmail ?? null,
  lastActiveDate: u.lastActiveAt.slice(0, 10),
  medals: { bronze: badgesBronze, silver: 0, gold: 0, diamond: 0, platinum: 0 },
  badgesTotal: badgesBronze,
  lastAdminAction: u.lastAdminAction ?? null,
  stripeCustomerId: u.stripeCustomerId ?? null,
  updatedAt: u.createdAt,
}));

// Fase 2 #1, al pie de la letra del documento canónico de Max: colección
// renombrada a supportTickets, campo `state` → `status`, más los campos
// nuevos del modelo (number, subjectLower, category, userEmail,
// priorityRank, assigneeName, channel, messagesCount, lastMessageAt,
// closedAt) y la subcolección messages con su propio hilo por ticket.
// `age` YA NO se guarda: el backend la calcula desde createdAt/closedAt.
// IDs y `number` fijos (no generados al azar): así `npm run seed` se puede
// correr varias veces sin ir acumulando tickets/mensajes duplicados —
// sobrescribe siempre los mismos documentos. El contador counters/ticketNumber
// queda sembrado en el máximo (1042) para que, si en el futuro algo crea un
// ticket real con nextTicketNumber(), el próximo número sea 1043.
const PRIORITY_RANK = { high: 0, med: 1, low: 2 };

const ticketsRaw = [
  {
    id: 'tck_a1b2c3d4e5', number: 1042,
    subject: 'No puedo iniciar sesión con Google', category: 'login',
    userId: 'usr_1', userName: 'Camila Rojas', userEmail: 'camila@correo.cl',
    priority: 'high', status: 'open', assigneeId: null, assigneeName: null, channel: 'app',
    createdAt: hoursAgo(2),
    messages: [
      { id: 'msg1', authorType: 'user', authorId: 'usr_1', authorName: 'Camila Rojas', body: 'No puedo iniciar sesión con mi cuenta de Google, me tira error.', internal: false, createdAt: hoursAgo(2) },
    ],
  },
  {
    id: 'tck_5d2e9f1a3b', number: 1041,
    subject: 'Cobro duplicado plan anual', category: 'payments',
    userId: 'usr_5', userName: 'María Vidal', userEmail: 'maria@correo.cl',
    priority: 'high', status: 'progress', assigneeId: 'adm_4', assigneeName: 'Soporte', channel: 'app',
    createdAt: hoursAgo(5),
    messages: [
      { id: 'msg1', authorType: 'user', authorId: 'usr_5', authorName: 'María Vidal', body: 'Me cobraron el plan anual dos veces este mes.', internal: false, createdAt: hoursAgo(5) },
      { id: 'msg2', authorType: 'agent', authorId: 'adm_4', authorName: 'Soporte', body: 'Hemos solicitado el reembolso a Stripe; verás el abono en 5–7 días.', internal: false, createdAt: hoursAgo(1) },
    ],
  },
  {
    id: 'tck_b7c8d9e0f1', number: 1038,
    subject: 'Badge no asignado tras acierto', category: 'other',
    userId: 'usr_2', userName: 'Juan López', userEmail: 'juan@correo.cl',
    priority: 'med', status: 'progress', assigneeId: 'adm_4', assigneeName: 'Soporte', channel: 'app',
    createdAt: daysAgo(1),
    messages: [
      { id: 'msg1', authorType: 'user', authorId: 'usr_2', authorName: 'Juan López', body: 'Respondí bien una pregunta y no me dieron el badge.', internal: false, createdAt: daysAgo(1) },
      { id: 'msg2', authorType: 'agent', authorId: 'adm_4', authorName: 'Soporte', body: 'Revisando logs de asignación de badges.', internal: true, createdAt: hoursAgo(3) },
    ],
  },
  {
    id: 'tck_c2d3e4f5a6', number: 1035,
    subject: 'No cargan preguntas de Ciencias', category: 'content',
    userId: 'usr_3', userName: 'Andrea Muñoz', userEmail: 'andrea@correo.cl',
    priority: 'med', status: 'open', assigneeId: null, assigneeName: null, channel: 'app',
    createdAt: daysAgo(1),
    messages: [
      { id: 'msg1', authorType: 'user', authorId: 'usr_3', authorName: 'Andrea Muñoz', body: 'La prueba de Ciencias se queda cargando y no muestra preguntas.', internal: false, createdAt: daysAgo(1) },
    ],
  },
  {
    id: 'tck_d4e5f6a7b8', number: 1029,
    subject: 'Solicito cambiar correo de cuenta', category: 'account',
    userId: 'usr_6', userName: 'Diego Soto', userEmail: 'diego@correo.cl',
    priority: 'low', status: 'closed', assigneeId: 'adm_1', assigneeName: 'Admin General', channel: 'email',
    createdAt: daysAgo(4), closedAt: daysAgo(3),
    messages: [
      { id: 'msg1', authorType: 'user', authorId: 'usr_6', authorName: 'Diego Soto', body: 'Necesito cambiar el correo asociado a mi cuenta.', internal: false, createdAt: daysAgo(4) },
      { id: 'msg2', authorType: 'agent', authorId: 'adm_1', authorName: 'Admin General', body: 'Listo, actualizamos tu correo. Cualquier cosa avísanos.', internal: false, createdAt: daysAgo(3) },
    ],
  },
];

// Fase 2 #6, al pie de la letra del documento canónico de Max: campo
// `state` → `status`, más los campos nuevos (questionTestId, questionAxis,
// questionDifficulty, questionStatement, proposedAnswer, potentialReward,
// rewardGranted, questionPatch, note, resolvedBy/resolvedByName,
// resolvedAt). El enum de `reason` (wrong_answer | ambiguous | typo |
// bad_explanation | other) + `comment` de texto libre ya estaba correcto.
const CONFIRM_REWARD = { tier: 'bronze', amount: 250 };
const questionsById = {
  qst_4d21: { testId: 'm1', axis: 'Álgebra', difficulty: 'd2', statement: 'Si 3x + 7 = 22, ¿cuál es x?' },
  qst_4d22: { testId: 'b1', axis: 'Célula', difficulty: 'd1', statement: '¿Cuál es la unidad básica de la vida?' },
};
// IDs fijos (no al azar) por la misma razón que en tickets: reseeding idempotente.
const correctionsRaw = [
  { id: 'cor_55', questionId: 'qst_4d21', userId: 'usr_1', userName: 'Camila Rojas', reason: 'wrong_answer', comment: 'Debería ser C', proposedAnswer: 'C', status: 'pending', createdAt: hoursAgo(20) },
  { id: 'cor_56', questionId: 'qst_4d22', userId: 'usr_2', userName: 'Juan López', reason: 'typo', comment: 'Error de tipeo en el enunciado', proposedAnswer: null, status: 'pending', createdAt: hoursAgo(14) },
  // Registros de prueba (no tocar los de arriba) para poder probar el filtro
  // por estado en la pestaña Recorrecciones: antes todos los seed venían en
  // `pending`, así que filtrar por "confirmada"/"rechazada" siempre daba
  // vacío y parecía que el filtro no funcionaba.
  {
    id: 'cor_57', questionId: 'qst_4d21', userId: 'usr_3', userName: 'Andrea Muñoz', reason: 'ambiguous', comment: 'Hay dos alternativas que podrían ser correctas', proposedAnswer: 'D', status: 'confirmed', createdAt: daysAgo(2),
    resolvedBy: 'adm_4', resolvedByName: 'Soporte', resolvedAt: daysAgo(1), note: 'Se revisó con el equipo académico, tiene razón.',
    rewardGranted: { userId: 'usr_3', ...CONFIRM_REWARD },
  },
  {
    id: 'cor_58', questionId: 'qst_4d22', userId: 'usr_4', userName: 'Tomás Gana', reason: 'bad_explanation', comment: 'La explicación no deja claro por qué es esa la respuesta', proposedAnswer: null, status: 'rejected', createdAt: daysAgo(2),
    resolvedBy: 'adm_4', resolvedByName: 'Soporte', resolvedAt: daysAgo(1), note: 'La explicación es correcta, se deja igual.',
    rewardGranted: null,
  },
];

const questions = [
  { id: 'qst_4d21', testId: 'm1', axis: 'Álgebra', difficulty: 'd2', statement: 'Si 3x + 7 = 22, ¿cuál es x?', options: ['3', '5', '6', '7', '10'], correctAnswer: 'B', explanation: '3x = 15 → x = 5.', requiredSkill: 'Resolver ecuaciones lineales.', status: 'published' },
  { id: 'qst_4d22', testId: 'b1', axis: 'Célula', difficulty: 'd1', statement: '¿Cuál es la unidad básica de la vida?', options: ['Átomo', 'Célula', 'Tejido', 'Órgano', 'Molécula'], correctAnswer: 'B', explanation: 'La célula es la unidad estructural y funcional.', requiredSkill: 'Conceptos básicos de biología.', status: 'published' },
];

// ── Operativa (sección 8 del modelo de Max) ─────────────────────────────────
// platforms: se añaden downloadsDelta, syncedAt y syncSource; fechas como timestamp;
// downloads es null para la PWA. storeUrl queda null (aún no hay URLs públicas reales).
const hoursAgoD = (h) => new Date(Date.now() - h * 60 * 60 * 1000);
const platforms = [
  { id: 'ios', name: 'iOS · App Store', version: '2.4.1', available: true, downloads: 58200, downloadsDelta: 140, storeUrl: null, updatedAt: new Date('2026-05-28T00:00:00Z'), syncedAt: hoursAgoD(2), syncSource: 'app_store_connect' },
  { id: 'android', name: 'Android · Google Play', version: '2.4.0', available: true, downloads: 70340, downloadsDelta: 170, storeUrl: null, updatedAt: new Date('2026-05-30T00:00:00Z'), syncedAt: hoursAgoD(2), syncSource: 'google_play' },
  { id: 'web', name: 'Web App (PWA)', version: '1.9.3', available: true, downloads: null, downloadsDelta: 0, storeUrl: null, updatedAt: new Date('2026-06-02T00:00:00Z'), syncedAt: hoursAgoD(2), syncSource: 'pwa_manifest' },
];

// serviceStatus/{login|badges|questions|payments|notif}: último snapshot de salud.
// uptimePct pasa a número; latencyMs a número (null si down); + consecutiveFailures, checkedAt, source.
const SVC_REGION = 'southamerica-west1';
const serviceStatus = [
  ['login', 'Inicio de sesión', 'Login', 'ok', 99.98, 118, 0],
  ['badges', 'Asignación de badges', 'Badge assignment', 'ok', 99.95, 90, 0],
  ['questions', 'Entrega de preguntas', 'Question delivery', 'deg', 99.4, 410, 2],
  ['payments', 'Pagos', 'Payments', 'ok', 100, 160, 0],
  ['notif', 'Notificaciones', 'Notifications', 'down', 97.1, null, 6],
].map(([id, es, en, state, uptimePct, latencyMs, consecutiveFailures]) => ({
  id, name: { es, en }, state, uptimePct, latencyMs, consecutiveFailures,
  checkedAt: hoursAgoD(0.05), source: 'cloud_monitoring',
}));

// opsConfig/{services|containers|sync}: qué se mide y marcas de sincronización.
const opsConfig = [
  {
    id: 'services',
    items: [
      ['login', 'Inicio de sesión', 'Login', 'login-https-check', 'auth-svc'],
      ['badges', 'Asignación de badges', 'Badge assignment', 'badges-health', 'badge-worker'],
      ['questions', 'Entrega de preguntas', 'Question delivery', 'content-health', 'content-svc'],
      ['payments', 'Pagos', 'Payments', 'payments-health', 'payments-svc'],
      ['notif', 'Notificaciones', 'Notifications', 'notif-health', 'notif-worker'],
    ].map(([key, es, en, uptimeCheckId, cloudRunService], i) => ({
      key, name: { es, en }, uptimeCheckId, cloudRunService, region: SVC_REGION, order: i + 1,
    })),
    updatedAt: SEED_NOW, updatedBy: 'seed',
  },
  {
    id: 'containers',
    items: [
      ['api-gateway', 'cloud_run', true, null],
      ['auth-svc', 'cloud_run', true, null],
      ['content-svc', 'cloud_run', true, null],
      ['badge-worker', 'cloud_run', true, null],
      ['db-primary', 'firestore', false, { cpu: null, mem: 'firestore.googleapis.com/document/read_count' }],
      ['notif-worker', 'cloud_run', true, null],
      ['redis-cache', 'memorystore', false, { cpu: 'redis.googleapis.com/stats/cpu_utilization', mem: 'redis.googleapis.com/stats/memory/usage_ratio' }],
      ['cdn-edge', 'cdn', false, { cpu: null, mem: null }],
    ].map(([name, kind, restartable, metric], i) => ({
      name, kind, region: kind === 'cdn' ? 'global' : SVC_REGION, restartable, metric, order: i + 1,
    })),
    updatedAt: SEED_NOW, updatedBy: 'seed',
  },
  { id: 'sync', storesSyncedAt: hoursAgoD(2), metricsAggregatedThrough: null, updatedAt: SEED_NOW },
];

const tutors = [
  { id: 'tut_1', name: 'Constanza Morales', initials: 'CM', avatarColor: '#1A365D', textColor: '#FFFFFF', subjects: ['m1', 'b1'], subjectsLabel: { es: 'Matemática · Biología', en: 'Math · Biology' }, modes: ['online', 'in_person'], modesLabel: { es: 'Online y Presencial', en: 'Online & In-Person' }, pricePerHour: 15000, currency: 'CLP', country: 'CL', languages: ['es'], bio: { es: 'Licenciada en Ciencias con 5 años de experiencia preparando la PAES.', en: 'Science graduate with 5 years of experience tutoring PAES.'}, yearsExperience: 5, verified: true, featured: true, online: false, rating: 5.0, reviewCount: 1, ratingSeed: { teaching: 5, punctuality: 5, mastery: 5 }, reviewCountSeed: 1, contact: { email: 'constanza@aprueba.cl', phone: '+56912345678' }, contactSharingDefault: true, status: 'active', createdAt: new Date().toISOString(), },
];

const metrics = {
  overview: {
    downloads: { total: 128540, month: 8200, deltaPct: 6.8 },
    mau: { value: 24800, deltaPct: 6.4 },
    converted: { value: 3180, rate: 12.8 },
    mrr: { value: 14250, deltaPct: 9.1 },
    badgesIssued: 512340,
    sponsorsActive: 6,
    downloadsByMonth: [
      { month: 'Ene', value: 14200 }, { month: 'Feb', value: 16800 }, { month: 'Mar', value: 15300 },
      { month: 'Abr', value: 19400 }, { month: 'May', value: 21100 }, { month: 'Jun', value: 24800 },
    ],
    revenueByPlan: [{ plan: 'uni', value: 4650 }, { plan: 'all', value: 9600 }],
    systemHealth: { status: 'degraded', servicesDown: 1 },
  },
  commercial: {
    downloads: 128540, dau: 6420, mau: 24800, converted: 3180, convRate: 12.8, mrr: 14250, benefitsRedeemed: 1920,
    funnel: [
      { label: 'Descargas', value: 128540 }, { label: 'Registrados', value: 61200 },
      { label: 'Activos (MAU)', value: 24800 }, { label: 'Convertidos', value: 3180 },
    ],
    revenueByPlan: [{ plan: 'uni', value: 4650 }, { plan: 'all', value: 9600 }],
    badgesByType: [
      { tier: 'bronze', value: 402000 }, { tier: 'silver', value: 78400 }, { tier: 'gold', value: 24300 },
      { tier: 'diamond', value: 6100 }, { tier: 'platinum', value: 1540 },
    ],
  },
};

async function seedCollection(col, rows) {
  const batch = db.batch();
  for (const row of rows) {
    const { id, ...rest } = row;
    batch.set(db.collection(col).doc(id), rest);
  }
  await batch.commit();
  console.log(`  ✓ ${col}: ${rows.length} docs`);
}

// Borra TODOS los documentos de una colección (y, si se pide, la
// subcolección `messages` de cada uno). Solo se usa sobre colecciones que
// en este proyecto son 100% datos de prueba del seed (supportTickets y
// corrections nunca tuvieron datos reales — ver MODELO_CAMBIOS.md), así que
// es seguro limpiarlas antes de volver a sembrar. Esto es lo que hace que
// `npm run seed` sea idempotente de verdad: antes solo sobrescribía por ID,
// así que un cambio de esquema de IDs entre corridas (como pasó al pasar de
// ids tipo '1042' a tck_...) dejaba tickets viejos duplicados.
async function clearCollection(col, { withMessages = false } = {}) {
  const snap = await db.collection(col).get();
  if (snap.empty) return;
  if (withMessages) {
    for (const doc of snap.docs) {
      const msgs = await doc.ref.collection('messages').get();
      if (msgs.empty) continue;
      const mb = db.batch();
      msgs.docs.forEach((m) => mb.delete(m.ref));
      await mb.commit();
    }
  }
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// Siembra supportTickets + su subcolección messages. No usa seedCollection()
// porque cada ticket escribe también documentos en una subcolección, algo
// que un batch.set() sobre la colección raíz no puede hacer. IDs de ticket
// y de mensaje son fijos (ver arriba) para que el seed sea idempotente.
async function seedTickets(rows) {
  await clearCollection(COL.tickets, { withMessages: true });
  const batch = db.batch();
  let maxNumber = 0;
  for (const raw of rows) {
    const { id, messages, ...ticket } = raw;
    maxNumber = Math.max(maxNumber, ticket.number);
    const lastMessageAt = messages[messages.length - 1]?.createdAt || ticket.createdAt;
    const expiresAt = ticket.closedAt
      ? new Date(new Date(ticket.closedAt).getTime() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    batch.set(db.collection(COL.tickets).doc(id), {
      ...ticket,
      subjectLower: ticket.subject.toLowerCase(),
      priorityRank: PRIORITY_RANK[ticket.priority],
      closedAt: ticket.closedAt || null,
      messagesCount: messages.length,
      lastMessageAt,
      updatedAt: lastMessageAt,
    });
    for (const m of messages) {
      const { id: msgId, ...msg } = m;
      batch.set(db.collection(COL.tickets).doc(id).collection('messages').doc(msgId), { ...msg, expiresAt });
    }
  }
  await batch.commit();
  // Deja el contador listo para el próximo ticket real (número máximo sembrado + 1).
  await db.collection(COL.counters).doc('ticketNumber').set({ value: maxNumber }, { merge: true });
  console.log(`  ✓ ${COL.tickets}: ${rows.length} docs (+ subcolección messages) · counters/ticketNumber = ${maxNumber}`);
}

async function seedCorrections(rows) {
  await clearCollection(COL.corrections);
  const batch = db.batch();
  for (const raw of rows) {
    const { id, ...rest } = raw;
    const q = questionsById[rest.questionId] || {};
    batch.set(db.collection(COL.corrections).doc(id), {
      ...rest,
      questionTestId: q.testId || null,
      questionAxis: q.axis || null,
      questionDifficulty: q.difficulty || null,
      questionStatement: (q.statement || '').slice(0, 120),
      potentialReward: CONFIRM_REWARD,
      questionPatch: raw.questionPatch ?? null,
      resolvedBy: raw.resolvedBy ?? null,
      resolvedByName: raw.resolvedByName ?? null,
      resolvedAt: raw.resolvedAt ?? null,
      note: raw.note ?? null,
      rewardGranted: raw.rewardGranted ?? null,
    });
  }
  await batch.commit();
  console.log(`  ✓ ${COL.corrections}: ${rows.length} docs`);
}

async function run() {
  assertSafeTarget('seed');
  console.log('Sembrando Firestore…');
  await seedCollection(COL.adminUsers, adminUsers);
  await seedCollection(COL.features, features);
  await seedCollection(COL.plans, plans);
  await seedCollection(COL.sponsors, sponsors);
  await seedCollection(COL.benefits, benefits);
  await seedCollection(COL.users, users);
  // El seed pisa users/{uid} pero NO sus subcolecciones: sin esto, los asientos de
  // medalLedger de corridas anteriores (p. ej. del smoke) se acumulan entre seeds.
  for (const u of users) {
    const led = await db.collection(COL.users).doc(u.id).collection('medalLedger').get();
    await Promise.all(led.docs.map((d) => d.ref.delete()));
  }
  await seedTickets(ticketsRaw);
  await seedCorrections(correctionsRaw);
  await seedCollection(COL.questions, questions);
  await seedCollection(COL.platforms, platforms);
  await seedCollection(COL.serviceStatus, serviceStatus);
  await seedCollection(COL.opsConfig, opsConfig);
  await clearCollection(COL.opsRestarts); // sin bloqueos de reinicio heredados de corridas anteriores
  console.log(`  ✓ ${COL.opsRestarts}: vaciada`);
  await seedCollection(COL.tutors, tutors);
  await db.collection(COL.metrics).doc('overview').set(metrics.overview);
  await db.collection(COL.metrics).doc('commercial').set(metrics.commercial);
  console.log('  ✓ metrics: 2 docs (overview, commercial)');
  const mm = await writeSyntheticMetrics(db, { sponsorIds: sponsors.filter((x) => !x.deletedAt).map((x) => x.id) });
  console.log(`  ✓ metricsDaily: ${mm.daily} docs · metricsMonthly: ${mm.monthly} docs (sintéticos)`);
  console.log('Listo. Usuarios admin de prueba:');
  console.log('  admin@aprueba.cl / admin123 (MFA otp 123456)');
  console.log('  finance@aprueba.cl / finance123 (MFA otp 123456)');
  console.log('  ops@aprueba.cl / ops123');
  console.log('  support@aprueba.cl / support123');
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
