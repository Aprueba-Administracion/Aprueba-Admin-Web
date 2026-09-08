// Entrada SOLO para desarrollo local (`npm start` / `npm run dev`).
// En Vercel no se usa este archivo: la función serverless en `api/index.js`
// importa `app.js` directamente y Vercel maneja el ciclo de vida del servidor.
import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[aprueba-admin-api] escuchando en http://localhost:${PORT}/api/v1`));
