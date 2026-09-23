// Corrige el esquema de los documentos que ya existen en la colección
// `benefits`, para que queden EXACTAMENTE como los define el documento de
// Max (Aprueba_Admin_Modelo_Datos_Firestore.docx, sección "benefits/{benefitId}"):
//
//   costPlatino   -> costPlatinum
//   redeemed      -> redeemedCount
//   (agrega)      -> active (boolean), sponsorName, description, icon,
//                    createdAt, updatedAt
//   id del doc    -> bnf_ + 10 hex (antes era "<sponsorId>__<algo>")
//
// A diferencia del script de Fase 1 original (migrate-sponsor-benefits.js),
// este SÍ reemplaza los documentos existentes: no son datos reales que nos
// haya entregado Max, son los 4 placeholders que generamos nosotros mismos
// la semana pasada, así que no hay riesgo de perder información real —
// solo estamos corrigiendo nuestro propio esquema.
//
// Uso (desde backend/):
//   node src/scripts/fix-benefits-schema.js --dry-run   (solo muestra qué haría)
//   node src/scripts/fix-benefits-schema.js             (corrige de verdad)

import 'dotenv/config';
import crypto from 'crypto';
import { db, FieldValue, COL } from '../data/repo.js';

const DRY_RUN = process.argv.includes('--dry-run');
const newBenefitId = () => `bnf_${crypto.randomBytes(5).toString('hex')}`;

// Un doc ya está en el esquema nuevo si tiene costPlatinum (y no costPlatino).
function needsFix(data) {
  return data.costPlatino !== undefined || data.redeemed !== undefined || data.costPlatinum === undefined;
}

async function main() {
  console.log('\n=== Corrección de esquema: colección "benefits" -> modelo canónico de Max ===');
  console.log(DRY_RUN ? '(modo --dry-run: no se escribe nada en Firestore)\n' : '(modo real: SE VA A ESCRIBIR EN FIRESTORE)\n');

  const [benefitsSnap, sponsorsSnap] = await Promise.all([
    db.collection(COL.benefits).get(),
    db.collection(COL.sponsors).get(),
  ]);
  const sponsorNameById = new Map(sponsorsSnap.docs.map((d) => [d.id, d.data().name || '']));

  console.log(`Documentos en "benefits": ${benefitsSnap.size}`);

  let fixed = 0;
  let skipped = 0;

  for (const doc of benefitsSnap.docs) {
    const data = doc.data();
    if (!needsFix(data)) {
      console.log(`\n[${doc.id}] ya está en el esquema nuevo, se omite.`);
      skipped++;
      continue;
    }

    const sponsorId = data.sponsorId;
    const stock = Number(data.stock) || 0;
    const newDoc = {
      sponsorId,
      sponsorName: sponsorNameById.get(sponsorId) || '',
      name: data.name || '',
      description: null,
      costPlatinum: Number(data.costPlatino ?? data.costPlatinum) || 0,
      stock,
      redeemedCount: Number(data.redeemed ?? data.redeemedCount) || 0,
      active: stock > 0,
      icon: null,
      expiresAt: data.expiresAt || null,
      // trazabilidad de la corrección, no forma parte del modelo de Max pero
      // es útil para no perder el rastro de que este doc fue reconstruido:
      placeholder: data.placeholder || false,
      note: data.note || null,
    };
    const newId = newBenefitId();

    console.log(`\n[${doc.id}] -> benefits/${newId}:`);
    console.log('   ', JSON.stringify(newDoc));

    if (!DRY_RUN) {
      await db.collection(COL.benefits).doc(newId).set({
        ...newDoc,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection(COL.benefits).doc(doc.id).delete();
    }
    fixed++;
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Corregidos: ${fixed} · Ya estaban bien: ${skipped}`);
  console.log(DRY_RUN
    ? '\nNada se escribió todavía. Si la lista de arriba se ve bien, corran el script sin --dry-run.'
    : '\nListo. Los documentos viejos (con costPlatino/redeemed) fueron reemplazados por documentos nuevos con el esquema correcto.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nError en la corrección:', err);
  process.exit(1);
});
