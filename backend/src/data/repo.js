// Capa de acceso a datos sobre Firestore. Centraliza la lectura/escritura por colección
// para que las rutas no toquen Firestore directamente.
import { db, FieldValue } from '../config/firebase.js';

export const COL = {
  adminUsers: 'adminUsers',
  features: 'features',
  plans: 'plans',
  sponsors: 'sponsors',
  // Catálogo de beneficios de sponsors (modelo canónico: colección raíz,
  // cada doc referencia a su sponsor con `sponsorId`). Antes vivía como un
  // array embebido dentro de cada sponsor; ver MODELO_CAMBIOS.md.
  benefits: 'benefits',
  users: 'users',
  // Renombrada a supportTickets según el modelo canónico de Max (antes
  // `tickets`); el campo de estado también pasó de `state` a `status`
  // (ver Fase 2, item #1, y MODELO_CAMBIOS.md).
  tickets: 'supportTickets',
  corrections: 'corrections',
  // Contadores atómicos (p. ej. counters/ticketNumber para el número
  // secuencial legible de supportTickets). Ver Fase 2, item #1.
  counters: 'counters',
  questions: 'questions',
  platforms: 'platforms',
  services: 'services',
  containers: 'containers',
  metrics: 'metrics', // documentos: overview, commercial
  auditLog: 'auditLog', // bitácora de acciones administrativas sensibles
  // Marketplace de tutores (lo consume en modo lectura el API del alumno).
  tutors: 'tutors',
  tutorReviews: 'tutorReviews',
  tutorRequests: 'tutorRequests',
};

const withId = (doc) => ({ id: doc.id, ...doc.data() });

export async function listAll(col, orderBy) {
  let q = db.collection(col);
  if (orderBy) q = q.orderBy(orderBy);
  const snap = await q.get();
  return snap.docs.map(withId);
}

// Trae los `limit` documentos más recientes de una colección según `field`
// (descendente), usando el propio orden/límite de Firestore en vez de bajar
// la colección completa para ordenarla en memoria. Se usa SOLO sin filtros
// `where` adicionales: combinar un where en un campo distinto con orderBy
// pediría un índice compuesto que este proyecto no tiene configurado, así
// que cualquier ruta que filtre sigue usando listAll() como antes.
export async function listRecent(col, field, limit) {
  const snap = await db.collection(col).orderBy(field, 'desc').limit(limit).get();
  return snap.docs.map(withId);
}

// Trae todos los documentos de una colección donde `field === value`
// (sin orderBy adicional, para no requerir un índice compuesto). Se usa,
// por ejemplo, para traer los beneficios de un sponsor: benefits donde
// sponsorId === <id>.
export async function listWhere(col, field, value) {
  const snap = await db.collection(col).where(field, '==', value).get();
  return snap.docs.map(withId);
}

export async function getDoc(col, id) {
  const snap = await db.collection(col).doc(id).get();
  return snap.exists ? withId(snap) : null;
}

export async function setDoc(col, id, data) {
  await db.collection(col).doc(id).set(data, { merge: false });
  return getDoc(col, id);
}

export async function patchDoc(col, id, data) {
  const ref = db.collection(col).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.set(data, { merge: true });
  return getDoc(col, id);
}

export async function addDoc(col, data, id) {
  const ref = id ? db.collection(col).doc(id) : db.collection(col).doc();
  await ref.set(data);
  return getDoc(col, ref.id);
}

export async function deleteDoc(col, id) {
  await db.collection(col).doc(id).delete();
}

export async function countActiveSubscriptions(planId) {
  const snap = await db.collection(COL.users).where('plan', '==', planId).where('state', '==', 'active').get();
  return snap.size;
}

// ── Subcolecciones (p. ej. supportTickets/{id}/messages) ──────────────────

export async function listSub(col, id, subcol, orderByField, limit) {
  let q = db.collection(col).doc(id).collection(subcol);
  if (orderByField) q = q.orderBy(orderByField);
  if (limit) q = q.limit(limit);
  const snap = await q.get();
  return snap.docs.map(withId);
}

// Agrega un documento a una subcolección DENTRO de un batch ya abierto por
// el llamador (para que la actualización del padre y la creación del
// mensaje queden en la misma operación atómica). Devuelve la ref creada.
export function subDocRef(col, id, subcol) {
  return db.collection(col).doc(id).collection(subcol).doc();
}

// Sobrescribe (merge) un campo en TODOS los documentos de una subcolección;
// se usa para el TTL de mensajes al cerrar/reabrir un ticket
// (supportTickets/{id}/messages/*.expiresAt).
export async function patchSubAll(col, id, subcol, data) {
  const snap = await db.collection(col).doc(id).collection(subcol).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.set(d.ref, data, { merge: true }));
  await batch.commit();
}

// counters/ticketNumber en transacción: número secuencial legible de
// supportTickets (modelo canónico de Max, Fase 2 #1). No lo usa ninguna
// ruta del admin hoy (los tickets los crea la app del alumno), pero el
// seed lo usa para sembrar tickets con numeración real y consistente.
export async function nextTicketNumber() {
  const ref = db.collection(COL.counters).doc('ticketNumber');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.exists ? snap.data().value || 0 : 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return next;
  });
}

export { db, FieldValue };
