// Inicialización del Firebase Admin SDK.
// Soporta cuatro modos, en este orden de prioridad:
//   1. FIREBASE_SERVICE_ACCOUNT_JSON  -> credenciales de cuenta de servicio
//      como variable de entorno (modo recomendado en Vercel: nunca subas
//      el archivo serviceAccount.json a un repo público).
//   2. GOOGLE_APPLICATION_CREDENTIALS -> credenciales de cuenta de servicio
//      desde un archivo local (modo recomendado para desarrollo local).
//   3. FIRESTORE_EMULATOR_HOST        -> Firestore local (emulador).
//   4. Credenciales por defecto del entorno (GCP / `gcloud auth`).
import admin from 'firebase-admin';

const projectId = process.env.GCLOUD_PROJECT || 'aprueba-dev';

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
    console.log('[firebase] Conectado a Firestore (credenciales desde variable de entorno)');
  } else if (process.env.FIRESTORE_EMULATOR_HOST) {
    // Modo emulador: no se necesitan credenciales reales.
    admin.initializeApp({ projectId });
    console.log(`[firebase] Conectado al emulador de Firestore en ${process.env.FIRESTORE_EMULATOR_HOST}`);
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    console.log('[firebase] Conectado a Firestore (credenciales del entorno)');
  }
}

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export default admin;
