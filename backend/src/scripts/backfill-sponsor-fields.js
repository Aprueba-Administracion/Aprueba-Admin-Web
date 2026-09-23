// Backfill de los campos nuevos del modelo canónico de Max sobre los
// sponsors que ya existen en Firestore (creados antes de esta corrección):
//
//   nameLower    -> name.toLowerCase(), para búsqueda case-insensitive
//   contactEmail -> null si no existe
//   deletedAt    -> null (ningún sponsor existente está dado de baja)
//   createdBy    -> null (no sabemos quién los creó originalmente)
//   updatedBy    -> null
//
// No toca `name`, `tier`, `monthlyFee`, `status` ni los beneficios — solo
// agrega los campos que falten, con merge:true (no destructivo).
//
// Uso (desde backend/):
//   node src/scripts/backfill-sponsor-fields.js --dry-run   (solo muestra qué haría)
//   node src/scripts/backfill-sponsor-fields.js             (corrige de verdad)

import 'dotenv/config';
import { db, COL } from '../data/repo.js';

const DRY_RUN = process.argv.includes('--dry-run');

function missingFields(data) {
  const patch = {};
  if (typeof data.nameLower !== 'string') patch.nameLower = String(data.name || '').trim().toLowerCase();
  if (data.contactEmail === undefined) patch.contactEmail = null;
  if (data.deletedAt === undefined) patch.deletedAt = null;
  if (data.createdBy === undefined) patch.createdBy = null;
  if (data.updatedBy === undefined) patch.updatedBy = null;
  return patch;
}

async function main() {
  console.log('\n=== Backfill de campos nuevos en "sponsors" (nameLower, contactEmail, deletedAt, createdBy, updatedBy) ===');
  console.log(DRY_RUN ? '(modo --dry-run: no se escribe nada en Firestore)\n' : '(modo real: SE VA A ESCRIBIR EN FIRESTORE)\n');

  const snap = await db.collection(COL.sponsors).get();
  console.log(`Sponsors encontrados: ${snap.size}`);

  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const patch = missingFields(data);
    if (Object.keys(patch).length === 0) {
      console.log(`\n[${doc.id}] "${data.name}" ya tiene todos los campos, se omite.`);
      skipped++;
      continue;
    }
    console.log(`\n[${doc.id}] "${data.name}" -> agrega:`, JSON.stringify(patch));
    if (!DRY_RUN) {
      await doc.ref.set(patch, { merge: true });
    }
    updated++;
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Actualizados: ${updated} · Ya estaban completos: ${skipped}`);
  console.log(DRY_RUN
    ? '\nNada se escribió todavía. Si la lista de arriba se ve bien, corran el script sin --dry-run.'
    : '\nListo. Los sponsors existentes ya tienen los campos del modelo canónico.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nError en el backfill:', err);
  process.exit(1);
});
