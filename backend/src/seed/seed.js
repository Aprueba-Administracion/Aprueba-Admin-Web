// Siembra Firestore (real o emulador) con los datos del wireframe / doc de API.
// Uso:  npm run seed     (respeta FIRESTORE_EMULATOR_HOST o credenciales reales)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, COL } from '../data/repo.js';

const hash = (p) => bcrypt.hashSync(p, 8);
const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);

const adminUsers = [
  { id: 'adm_1', name: 'Admin General', email: 'admin@aprueba.cl', role: 'admin', mfaEnabled: true, passwordHash: hash('admin123') },
  { id: 'adm_2', name: 'Finanzas', email: 'finance@aprueba.cl', role: 'finance', mfaEnabled: true, passwordHash: hash('finance123') },
  { id: 'adm_3', name: 'Operaciones', email: 'ops@aprueba.cl', role: 'ops', mfaEnabled: false, passwordHash: hash('ops123') },
  { id: 'adm_4', name: 'Soporte', email: 'support@aprueba.cl', role: 'support', mfaEnabled: false, passwordHash: hash('support123') },
];

const features = [
  { id: 'f1', ic: '♾️', name_es: 'Preguntas ilimitadas', name_en: 'Unlimited questions' },
  { id: 'f2', ic: '📝', name_es: 'Modo facsímil (ensayos)', name_en: 'Facsimile mode (mocks)' },
  { id: 'f3', ic: '📖', name_es: 'Explicaciones paso a paso', name_en: 'Step-by-step explanations' },
  { id: 'f4', ic: '⚑', name_es: 'Recorrección de preguntas', name_en: 'Question correction requests' },
  { id: 'f5', ic: '👥', name_es: 'Grupos de estudio', name_en: 'Study groups' },
  { id: 'f6', ic: '📊', name_es: 'Estadísticas avanzadas', name_en: 'Advanced stats' },
  { id: 'f7', ic: '🎁', name_es: 'Beneficios de sponsors', name_en: 'Sponsor benefits' },
  { id: 'f8', ic: '🚫', name_es: 'Sin anuncios', name_en: 'No ads' },
  { id: 'f9', ic: '⬇️', name_es: 'Descarga offline', name_en: 'Offline download' },
  { id: 'f10', ic: '⭐', name_es: 'Soporte prioritario', name_en: 'Priority support' },
];

// Planes con el NUEVO campo badges{login, purchase, correct} (badges por acción).
const plans = [
  { id: 'free', name: 'Gratis', price: 0, color: '#64748B', features: ['f3'], limits: { qDay: 20, groups: 1, tests: 1 }, badges: { login: 1, purchase: 0, correct: 1 } },
  { id: 'uni', name: '1 prueba ilimitada', price: 1, color: '#1A365D', features: ['f1', 'f3', 'f4'], limits: { qDay: 0, groups: 3, tests: 1 }, badges: { login: 1, purchase: 5, correct: 1 } },
  { id: 'all', name: 'Todas las pruebas', price: 5, color: '#F5B041', features: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'], limits: { qDay: 0, groups: 0, tests: 99 }, badges: { login: 2, purchase: 10, correct: 2 } },
];

const sponsors = [
  { id: 'spo_1', name: 'Preuniversitario Pedro de V.', tier: 'Gold', monthlyFee: 3200, benefitsOffered: 4, benefitsRedeemed: 640, status: 'ok' },
  { id: 'spo_2', name: 'Librería Antártica', tier: 'Silver', monthlyFee: 1800, benefitsOffered: 2, benefitsRedeemed: 410, status: 'ok' },
  { id: 'spo_3', name: 'Banco Estudiantil', tier: 'Gold', monthlyFee: 2400, benefitsOffered: 3, benefitsRedeemed: 520, status: 'ok' },
  { id: 'spo_4', name: 'Café Cultura', tier: 'Bronze', monthlyFee: 900, benefitsOffered: 1, benefitsRedeemed: 180, status: 'deg' },
  { id: 'spo_5', name: 'EdiTextos PAES', tier: 'Silver', monthlyFee: 1300, benefitsOffered: 2, benefitsRedeemed: 170, status: 'ok' },
];

const users = [
  { id: 'usr_1', name: 'Camila Rojas', email: 'camila@correo.cl', country: 'CL', plan: 'all', state: 'active', lastActivity: 'hoy', badges: 412, subscription: { id: 'sub_77', status: 'active' }, groups: 2 },
  { id: 'usr_2', name: 'Juan López', email: 'juan@correo.cl', country: 'CL', plan: 'uni', state: 'active', lastActivity: 'hoy', badges: 188, subscription: { id: 'sub_78', status: 'active' }, groups: 1 },
  { id: 'usr_3', name: 'Andrea Muñoz', email: 'andrea@correo.cl', country: 'CL', plan: 'free', state: 'active', lastActivity: 'ayer', badges: 54, groups: 0 },
  { id: 'usr_4', name: 'Tomás Gana', email: 'tomas@correo.cl', country: 'PE', plan: 'free', state: 'suspended', lastActivity: '12 may', badges: 31, groups: 0 },
  { id: 'usr_5', name: 'María Vidal', email: 'maria@correo.cl', country: 'CL', plan: 'all', state: 'active', lastActivity: 'hoy', badges: 276, subscription: { id: 'sub_80', status: 'active' }, groups: 3 },
  { id: 'usr_6', name: 'Diego Soto', email: 'diego@correo.cl', country: 'CL', plan: 'uni', state: 'churned', lastActivity: '02 abr', badges: 140, groups: 1 },
];

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

const platforms = [
  { id: 'ios', platform: 'iOS · App Store', version: '2.4.1', available: true, downloads: 58200, updatedAt: '2026-05-28' },
  { id: 'android', platform: 'Android · Google Play', version: '2.4.0', available: true, downloads: 70340, updatedAt: '2026-05-30' },
  { id: 'web', platform: 'Web App (PWA)', version: '1.9.3', available: true, downloads: 0, updatedAt: '2026-06-02' },
];

const services = [
  { id: 'login', key: 'login', name: 'Inicio de sesión', state: 'ok', uptime: '99.98%', latency: '118 ms' },
  { id: 'badges', key: 'badges', name: 'Asignación de badges', state: 'ok', uptime: '99.95%', latency: '90 ms' },
  { id: 'questions', key: 'questions', name: 'Entrega de preguntas', state: 'deg', uptime: '99.40%', latency: '410 ms' },
  { id: 'payments', key: 'payments', name: 'Pagos', state: 'ok', uptime: '100%', latency: '160 ms' },
  { id: 'notif', key: 'notif', name: 'Notificaciones', state: 'down', uptime: '97.10%', latency: null },
];

const containers = [
  { id: 'api-gateway', name: 'api-gateway', state: 'ok', cpu: 34, mem: 51, region: 'us-east' },
  { id: 'auth-svc', name: 'auth-svc', state: 'ok', cpu: 22, mem: 40, region: 'us-east' },
  { id: 'content-svc', name: 'content-svc', state: 'deg', cpu: 78, mem: 69, region: 'us-east' },
  { id: 'badge-worker', name: 'badge-worker', state: 'ok', cpu: 18, mem: 33, region: 'us-east' },
  { id: 'db-primary', name: 'db-primary', state: 'ok', cpu: 46, mem: 72, region: 'us-east' },
  { id: 'notif-worker', name: 'notif-worker', state: 'down', cpu: 0, mem: 0, region: 'us-east' },
  { id: 'redis-cache', name: 'redis-cache', state: 'ok', cpu: 12, mem: 28, region: 'us-east' },
  { id: 'cdn-edge', name: 'cdn-edge', state: 'ok', cpu: 8, mem: 14, region: 'global' },
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
  console.log('Sembrando Firestore…');
  await seedCollection(COL.adminUsers, adminUsers);
  await seedCollection(COL.features, features);
  await seedCollection(COL.plans, plans);
  await seedCollection(COL.sponsors, sponsors);
  await seedCollection(COL.users, users);
  await seedTickets(ticketsRaw);
  await seedCorrections(correctionsRaw);
  await seedCollection(COL.questions, questions);
  await seedCollection(COL.platforms, platforms);
  await seedCollection(COL.services, services);
  await seedCollection(COL.containers, containers);
  await seedCollection(COL.tutors, tutors);
  await db.collection(COL.metrics).doc('overview').set(metrics.overview);
  await db.collection(COL.metrics).doc('commercial').set(metrics.commercial);
  console.log('  ✓ metrics: 2 docs (overview, commercial)');
  console.log('Listo. Usuarios admin de prueba:');
  console.log('  admin@aprueba.cl / admin123 (MFA otp 123456)');
  console.log('  finance@aprueba.cl / finance123 (MFA otp 123456)');
  console.log('  ops@aprueba.cl / ops123');
  console.log('  support@aprueba.cl / support123');
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
