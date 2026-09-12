// Utilidad de mantenimiento SOLO para entorno de pruebas: vacía por completo
// la colección `auditLog` en Firestore. No es parte de la API ni se expone
// desde el panel — se corre a mano desde la terminal cuando hace falta.
//
// Uso:  npm run clear:audit     (respeta FIRESTORE_EMULATOR_HOST o credenciales reales,
//                                 igual que `npm run seed`)
import 'dotenv/config';
import { db, COL } from '../data/repo.js';

async function clearCollection(colName, batchSize = 300) {
  const colRef = db.collection(colName);
  let deleted = 0;
  // Se borra en tandas para no exceder el límite de un batch de Firestore (500 ops).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await colRef.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    console.log(`  … ${deleted} documentos borrados`);
  }
  return deleted;
}

(async () => {
  console.log(`Vaciando la colección "${COL.auditLog}"…`);
  const total = await clearCollection(COL.auditLog);
  console.log(`Listo: ${total} documentos borrados de "${COL.auditLog}".`);
  process.exit(0);
})().catch((e) => {
  console.error('Error al vaciar la bitácora:', e);
  process.exit(1);
});
