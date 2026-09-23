// Migración Fase 1: puebla la nueva colección raíz `benefits` a partir de
// lo que hay hoy en cada sponsor.
//
// Se descubrió (corriendo este script en --dry-run) que en el Firebase real
// casi ningún sponsor tiene el array `benefits[]` detallado: solo tienen los
// números resumen `benefitsOffered` / `benefitsRedeemed`. Por eso el script
// cubre dos casos:
//   1. Sponsor CON array `benefits[]` (viejo formato, detallado): se copia
//      cada beneficio tal cual, 1 a 1, a un doc nuevo en `benefits`.
//   2. Sponsor SIN array `benefits[]` pero con totales > 0: se reconstruye
//      UN beneficio "placeholder" que representa el agregado, marcado con
//      `placeholder: true` para que después el equipo de finanzas lo revise
//      y le ponga nombre/costo reales en la UI (el costo en Platino no se
//      puede reconstruir desde los totales, así que queda en 0 y con una nota).
//
// NO borra ni modifica nada dentro de `sponsors/{id}` (ni el array `benefits`
// si existe, ni los totales). Este es un primer paso NO destructivo: solo
// agrega documentos nuevos. Borrar el array embebido y actualizar
// routes/sponsors.js para leer desde la colección nueva es un paso aparte,
// que se hace después de confirmar que la copia quedó bien.
//
// Uso:
//   node src/scripts/migrate-sponsor-benefits.js --dry-run   (solo muestra qué haría, no escribe nada)
//   node src/scripts/migrate-sponsor-benefits.js             (escribe de verdad)
//
// Se ejecuta desde la carpeta backend/, igual que "npm run seed".
// Usa las mismas credenciales de Firebase que ya tienen configuradas
// localmente (GOOGLE_APPLICATION_CREDENTIALS / variables de entorno),
// por eso reutiliza src/config/firebase.js sin tocar nada de esa parte.

import 'dotenv/config';
import { db } from '../config/firebase.js';
import { COL } from '../data/repo.js';

const DRY_RUN = process.argv.includes('--dry-run');

function benefitDocId(sponsorId, benefit) {
  // Id determinístico: si corremos el script dos veces, no duplica documentos.
  return `${sponsorId}__${benefit.id}`;
}

function placeholderDocId(sponsorId) {
  return `${sponsorId}__general`;
}

async function main() {
  console.log(`\n=== Migración Fase 1: sponsors.benefits[] -> colección "benefits" ===`);
  console.log(DRY_RUN ? '(modo --dry-run: no se escribe nada en Firestore)\n' : '(modo real: SE VA A ESCRIBIR EN FIRESTORE)\n');

  const sponsorsSnap = await db.collection(COL.sponsors).get();
  console.log(`Sponsors encontrados: ${sponsorsSnap.size}`);

  // Diagnóstico: mostramos qué campos tiene cada sponsor tal cual está en
  // Firestore, para detectar si "benefits" viene vacío, no existe, o tiene
  // otro nombre/forma de la que esperamos.
  console.log('\n--- Diagnóstico (contenido real de cada sponsor) ---');
  for (const doc of sponsorsSnap.docs) {
    const data = doc.data();
    console.log(`\n[${doc.id}] campos: ${Object.keys(data).join(', ')}`);
    console.log(`   benefits: ${JSON.stringify(data.benefits)}`);
    console.log(`   benefitsOffered: ${data.benefitsOffered}, benefitsRedeemed: ${data.benefitsRedeemed}`);
  }
  console.log('--- fin diagnóstico ---\n');

  let totalBenefits = 0;
  let totalSponsorsConBeneficios = 0;
  let batch = DRY_RUN ? null : db.batch();
  let opsInBatch = 0;
  const BATCH_LIMIT = 400; // margen bajo el límite de 500 escrituras de Firestore

  async function flushBatch() {
    if (DRY_RUN || opsInBatch === 0) return;
    await batch.commit();
    batch = db.batch();
    opsInBatch = 0;
  }

  let totalPlaceholders = 0;

  for (const doc of sponsorsSnap.docs) {
    const sponsor = doc.data();
    const sponsorId = doc.id;
    const benefits = Array.isArray(sponsor.benefits) ? sponsor.benefits : [];

    if (benefits.length > 0) {
      // Caso 1: ya tiene beneficios detallados -> se copian tal cual.
      totalSponsorsConBeneficios++;
      console.log(`\nSponsor "${sponsor.name || sponsorId}" (${sponsorId}): ${benefits.length} beneficio(s) detallado(s)`);

      for (const b of benefits) {
        const newId = benefitDocId(sponsorId, b);
        const newDoc = {
          sponsorId,
          name: b.name || '',
          costPlatino: Number(b.costPlatino) || 0,
          stock: Number(b.stock) || 0,
          redeemed: Number(b.redeemed) || 0,
          expiresAt: b.expiresAt || null,
          placeholder: false,
          // guardamos el id original del beneficio embebido por trazabilidad
          legacyId: b.id || null,
        };

        console.log(`   -> benefits/${newId}:`, JSON.stringify(newDoc));
        totalBenefits++;

        if (!DRY_RUN) {
          const ref = db.collection('benefits').doc(newId);
          batch.set(ref, newDoc, { merge: true }); // merge:true = seguro correr el script más de una vez
          opsInBatch++;
          if (opsInBatch >= BATCH_LIMIT) await flushBatch();
        }
      }
      continue;
    }

    // Caso 2: no tiene array detallado, pero sí totales > 0 -> se reconstruye
    // UN beneficio "placeholder" que representa el agregado. El costo en
    // Platino no existe en los totales, así que queda en 0 y marcado para
    // revisión manual de finanzas en la UI.
    const offered = Number(sponsor.benefitsOffered) || 0;
    const redeemed = Number(sponsor.benefitsRedeemed) || 0;
    if (offered === 0 && redeemed === 0) {
      console.log(`\nSponsor "${sponsor.name || sponsorId}" (${sponsorId}): sin beneficios ni totales, se omite`);
      continue;
    }

    totalSponsorsConBeneficios++;
    totalPlaceholders++;
    const newId = placeholderDocId(sponsorId);
    const newDoc = {
      sponsorId,
      name: 'Beneficio general (migrado, revisar)',
      costPlatino: 0,
      stock: Math.max(0, offered - redeemed),
      redeemed,
      expiresAt: null,
      placeholder: true,
      legacyId: null,
      note: 'Reconstruido desde benefitsOffered/benefitsRedeemed del sponsor. No tenía beneficios detallados en Firestore. Revisar nombre y costo en Platino en la UI.',
    };

    console.log(`\nSponsor "${sponsor.name || sponsorId}" (${sponsorId}): sin detalle, se reconstruye placeholder desde totales (offered=${offered}, redeemed=${redeemed})`);
    console.log(`   -> benefits/${newId}:`, JSON.stringify(newDoc));
    totalBenefits++;

    if (!DRY_RUN) {
      const ref = db.collection('benefits').doc(newId);
      batch.set(ref, newDoc, { merge: true });
      opsInBatch++;
      if (opsInBatch >= BATCH_LIMIT) await flushBatch();
    }
  }

  await flushBatch();

  console.log(`\n=== Resumen ===`);
  console.log(`Sponsors con beneficios (detallados o reconstruidos): ${totalSponsorsConBeneficios} / ${sponsorsSnap.size}`);
  console.log(`Beneficios ${DRY_RUN ? 'que se copiarían/crearían' : 'copiados/creados'}: ${totalBenefits} (de ellos, ${totalPlaceholders} placeholder por reconstruir desde totales)`);
  console.log(DRY_RUN
    ? '\nNada se escribió todavía. Si la lista de arriba se ve bien, corran el script sin --dry-run.'
    : '\nListo. Los datos originales de cada sponsor (array benefits si existía, y los totales) siguen intactos, no se tocó ni se borró nada. Los placeholders quedaron marcados con placeholder:true y una nota para que finanzas los revise en la UI.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nError en la migración:', err);
  process.exit(1);
});
