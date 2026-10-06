// Migración del punto #8 de MODELO_CAMBIOS.md (plans y features al modelo canónico de Max).
// NO destructiva con los datos de negocio: convierte formatos y completa campos.
//
//  plans:
//    name (string)   -> name {es,en}   (copia el valor actual a ambos idiomas)
//    price (número)  -> price {monthly: n, yearly: null}   (el anual lo gestiona la app)
//    + nameLower, nameKey (pl_free|pl_uni|pl_all o null), currency 'USD', system (free/uni/all),
//      published true, popular false, order, stripeProductId null, stripePriceIds {null,null},
//      createdAt/updatedAt (si faltan), createdBy/updatedBy null
//  features:
//    name_es/name_en -> name {es,en}; ic -> icon; + key, description null, order, active true
//    (se eliminan los campos legados name_es, name_en, ic)
//
// Es idempotente: lo que ya está migrado se omite.
//
// Uso (desde backend/). Sin emulador el candado exige --real a propósito:
//   node src/scripts/migrate-plans.js --dry-run --real   (solo muestra qué haría)
//   node src/scripts/migrate-plans.js --real             (migra de verdad)
import 'dotenv/config';
import { FieldValue } from 'firebase-admin/firestore';
import { db, COL } from '../data/repo.js';
import { assertSafeTarget } from '../lib/envGuard.js';

const DRY_RUN = process.argv.includes('--dry-run');
const SYSTEM = ['free', 'uni', 'all'];
const NAME_KEYS = { free: 'pl_free', uni: 'pl_uni', all: 'pl_all' };
const FEATURE_KEYS = {
  f1: 'unlimited_questions', f2: 'mock_mode', f3: 'explanations', f4: 'corrections', f5: 'study_groups',
  f6: 'advanced_stats', f7: 'sponsor_benefits', f8: 'no_ads', f9: 'offline', f10: 'priority_support',
};

function planPatch(id, d, orderFallback) {
  const p = {};
  if (typeof d.name === 'string' || d.name === undefined) { const n = String(d.name || id); p.name = { es: n, en: n }; }
  const nm = p.name || d.name;
  if (typeof d.nameLower !== 'string') p.nameLower = String(nm.es || '').trim().toLowerCase();
  if (d.nameKey === undefined) p.nameKey = NAME_KEYS[id] || null;
  if (typeof d.price !== 'object' || d.price === null) p.price = { monthly: Number(d.price || 0), yearly: null };
  if (!d.currency) p.currency = 'USD';
  if (typeof d.system !== 'boolean') p.system = SYSTEM.includes(id);
  if (typeof d.published !== 'boolean') p.published = true;
  if (typeof d.popular !== 'boolean') p.popular = id === 'all';
  if (typeof d.order !== 'number') p.order = SYSTEM.includes(id) ? SYSTEM.indexOf(id) + 1 : orderFallback;
  if (d.stripeProductId === undefined) p.stripeProductId = null;
  if (!d.stripePriceIds) p.stripePriceIds = { monthly: null, yearly: null };
  if (!d.createdAt) p.createdAt = FieldValue.serverTimestamp();
  if (!d.updatedAt) p.updatedAt = FieldValue.serverTimestamp();
  if (d.createdBy === undefined) p.createdBy = null;
  if (d.updatedBy === undefined) p.updatedBy = null;
  return p;
}

function featurePatch(id, d) {
  const p = {};
  if (!d.name || typeof d.name !== 'object') p.name = { es: d.name_es || '', en: d.name_en || d.name_es || '' };
  if (d.name_es !== undefined) p.name_es = FieldValue.delete();
  if (d.name_en !== undefined) p.name_en = FieldValue.delete();
  if (d.icon === undefined) p.icon = d.ic || '';
  if (d.ic !== undefined) p.ic = FieldValue.delete();
  if (!d.key) p.key = FEATURE_KEYS[id] || id;
  if (d.description === undefined) p.description = null;
  if (typeof d.order !== 'number') p.order = Number(String(id).replace(/\D/g, '')) || 99;
  if (typeof d.active !== 'boolean') p.active = true;
  return p;
}

async function run(col, label, patchFn) {
  const snap = await db.collection(col).get();
  console.log(`\n--- ${label}: ${snap.size} documentos ---`);
  let n = 0; let skipped = 0;
  for (const [i, doc] of snap.docs.entries()) {
    const patch = patchFn(doc.id, doc.data(), i + 1);
    if (!Object.keys(patch).length) { console.log(`[${doc.id}] ya migrado, se omite.`); skipped++; continue; }
    console.log(`[${doc.id}] -> ${Object.keys(patch).join(', ')}`);
    if (!DRY_RUN) await doc.ref.set(patch, { merge: true });
    n++;
  }
  return { n, skipped };
}

async function main() {
  assertSafeTarget('migrate:plans');
  console.log(DRY_RUN ? '=== MIGRACIÓN plans/features (--dry-run: no se escribe nada) ===' : '=== MIGRACIÓN plans/features (SE VA A ESCRIBIR) ===');
  const a = await run(COL.plans, 'plans', planPatch);
  const b = await run(COL.features, 'features', featurePatch);
  console.log(`\n=== Resumen ===\nplans: ${a.n} migrados, ${a.skipped} ya listos · features: ${b.n} migradas, ${b.skipped} ya listas`);
  console.log(DRY_RUN ? '\nNada se escribió. Si se ve bien, corre sin --dry-run.' : '\nListo.');
  process.exit(0);
}
main().catch((e) => { console.error('\nError en la migración:', e); process.exit(1); });
