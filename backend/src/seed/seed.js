// Siembra Firestore (real o emulador) con los datos del wireframe / doc de API.
// Uso:  npm run seed     (respeta FIRESTORE_EMULATOR_HOST o credenciales reales)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, COL } from '../data/repo.js';

const hash = (p) => bcrypt.hashSync(p, 8);

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

const tickets = [
  { id: '1042', subject: 'No puedo iniciar sesión con Google', user: 'Camila Rojas', priority: 'high', state: 'open', age: '2 h' },
  { id: '1041', subject: 'Cobro duplicado plan anual', user: 'María Vidal', priority: 'high', state: 'progress', age: '5 h' },
  { id: '1038', subject: 'Badge no asignado tras acierto', user: 'Juan López', priority: 'med', state: 'progress', age: '1 d' },
  { id: '1035', subject: 'No cargan preguntas de Ciencias', user: 'Andrea Muñoz', priority: 'med', state: 'open', age: '1 d' },
  { id: '1029', subject: 'Solicito cambiar correo de cuenta', user: 'Diego Soto', priority: 'low', state: 'closed', age: '4 d' },
];

const corrections = [
  { id: 'cor_55', questionId: 'qst_4d21', userId: 'usr_1', reason: 'wrong_answer', comment: 'Debería ser C', state: 'pending', createdAt: '2026-06-04T08:00:00Z' },
  { id: 'cor_56', questionId: 'qst_4d22', userId: 'usr_2', reason: 'typo', comment: 'Error de tipeo en el enunciado', state: 'pending', createdAt: '2026-06-04T09:30:00Z' },
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

async function run() {
  console.log('Sembrando Firestore…');
  await seedCollection(COL.adminUsers, adminUsers);
  await seedCollection(COL.features, features);
  await seedCollection(COL.plans, plans);
  await seedCollection(COL.sponsors, sponsors);
  await seedCollection(COL.users, users);
  await seedCollection(COL.tickets, tickets);
  await seedCollection(COL.corrections, corrections);
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
