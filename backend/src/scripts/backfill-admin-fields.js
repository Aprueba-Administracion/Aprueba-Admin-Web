// Backfill de los campos del modelo canónico de Max sobre los adminUsers que
// ya existen en Firestore (punto #7 del MODELO_CAMBIOS.md):
//
//   emailLower       -> email en minúsculas (clave de búsqueda del login)
//   active           -> true (si existía el campo legado `disabled: true` => false)
//   failedLoginCount -> 0
//   lockedUntil      -> null
//   lastLoginAt      -> null
//   mfaSecret        -> null (el TOTP cifrado con KMS no aplica aún; sigue el OTP de demo)
//   createdAt/updatedAt -> ahora, solo si faltan
//
// No toca name, email, passwordHash, role ni mfaEnabled. Solo agrega lo que
// falte, con merge:true (no destructivo).
//
// OJO: el login busca por emailLower, pero tiene una búsqueda de respaldo, así
// que correr este script NO es urgente para poder entrar; igual hay que correrlo.
//
// Uso (desde backend/). Sin emulador, el candado exige --real a propósito:
//   node src/scripts/backfill-admin-fields.js --dry-run --real   (solo muestra qué haría)
//   node src/scripts/backfill-admin-fields.js --real             (corrige de verdad)
import 'dotenv/config';
import { FieldValue } from 'firebase-admin/firestore';
import { db, COL } from '../data/repo.js';
import { assertSafeTarget } from '../lib/envGuard.js';

const DRY_RUN = process.argv.includes('--dry-run');

function missingFields(data) {
  const patch = {};
  if (typeof data.emailLower !== 'string') patch.emailLower = String(data.email || '').trim().toLowerCase();
  if (typeof data.active !== 'boolean') patch.active = data.disabled === true ? false : true;
  if (data.disabled !== undefined) patch.disabled = FieldValue.delete();
  if (typeof data.failedLoginCount !== 'number') patch.failedLoginCount = 0;
  if (data.lockedUntil === undefined) patch.lockedUntil = null;
  if (data.lastLoginAt === undefined) patch.lastLoginAt = null;
  if (data.mfaSecret === undefined) patch.mfaSecret = null;
  if (!data.createdAt) patch.createdAt = FieldValue.serverTimestamp();
  if (!data.updatedAt) patch.updatedAt = FieldValue.serverTimestamp();
  return patch;
}

async function main() {
  assertSafeTarget('backfill:admin-fields');
  console.log('\n=== Backfill de campos nuevos en "adminUsers" ===');
  console.log(DRY_RUN ? '(modo --dry-run: no se escribe nada)\n' : '(modo real: SE VA A ESCRIBIR)\n');
  const snap = await db.collection(COL.adminUsers).get();
  console.log(`adminUsers encontrados: ${snap.size}`);
  let updated = 0; let skipped = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const patch = missingFields(data);
    if (!Object.keys(patch).length) { console.log(`\n[${doc.id}] "${data.email}" ya está completo, se omite.`); skipped++; continue; }
    console.log(`\n[${doc.id}] "${data.email}" -> agrega campos:`, Object.keys(patch).join(', '));
    if (!DRY_RUN) await doc.ref.set(patch, { merge: true });
    updated++;
  }
  console.log(`\n=== Resumen ===\nActualizados: ${updated} · Ya completos: ${skipped}`);
  console.log(DRY_RUN ? '\nNada se escribió. Si se ve bien, corre sin --dry-run.' : '\nListo.');
  process.exit(0);
}
main().catch((e) => { console.error('\nError en el backfill:', e); process.exit(1); });
