// Función serverless de Vercel: reexporta la app de Express del backend.
// Vercel invoca este handler para toda request que cae bajo /api/* según
// el rewrite definido en vercel.json (raíz del repo).
import app from '../backend/src/app.js';

export default app;
