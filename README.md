# Aprueba · Consola de administración (web full-stack)

Implementación de la **consola web de administración** de Aprueba a partir del wireframe
`Aprueba_Admin_Wireframe.html`, el contrato de `Aprueba_API_Backend.docx` y el modelo de datos Firestore.

- **Frontend:** React 18 + Vite + React Router (JavaScript). Estilos portados 1:1 del wireframe (tokens de marca, tema claro/oscuro, ES/EN).
- **Backend:** Node.js + Express + **Firebase Admin SDK (Firestore)**. JWT con roles (`admin`, `finance`, `ops`, `support`) y MFA.
- Reusa el **mismo contrato de API** que la app Flutter (envelope `{data,error,meta}`, rutas `/api/v1`, JWT con claims `sub/role/plan`).

## Estado del despliegue

- **Repo:** GitHub, organización `Aprueba-Administracion`, público.
- **Base de datos:** proyecto Firebase real `aprueba-admin` (Firestore) — ya sembrado con datos de prueba (planes, usuarios, sponsors, tickets, métricas, etc. vía `npm run seed`), no el emulador.
- **Hosting:** desplegado en Vercel (frontend estático + backend como función serverless, ver sección de despliegue más abajo). Cada integrante del equipo conectó su propia cuenta de Vercel al mismo repo, así que cada push a `main` dispara un deploy automático en los proyectos de ambos.
  - Deploy de referencia: https://aprueba-admin-web-neon.vercel.app
- **Último check:** login y datos verificados funcionando en producción con los usuarios de prueba de la tabla de abajo.

## Estructura
```
api/       Función serverless de Vercel (reexporta backend/src/app.js)
backend/   API REST Express + Firestore (rutas /api/v1/admin/*)
frontend/  SPA React (8 vistas: Resumen, Comercial, Sponsors | Operativa, Usuarios y soporte,
           Tutores, Contenido, Planes y productos)
docs/      Documentación de referencia del proyecto (plan de sprints, contrato de API, modelo de datos, wireframe)
```

### Vistas y roles
| Vista | Ruta | Rol mínimo | Endpoints que consume |
|---|---|---|---|
| Resumen | `/` | cualquiera | `metrics/overview`, `services` (si es ops) |
| Comercial | `/comercial` | finance | `metrics/commercial`, `metrics/overview` |
| Sponsors | `/sponsors` | finance | `sponsors` (GET/POST/PATCH/DELETE) |
| Operativa | `/operativa` | ops | `platforms`, `services`, `containers`, `containers/:name/restart` |
| Usuarios y soporte | `/usuarios` | support | `users`, `users/:id`, `tickets`, `corrections` |
| Tutores | `/tutores` | support (borrado: admin) | `tutors` completo + `tutors/:id/verification` y moderación de reseñas |
| Contenido | `/contenido` | admin | `questions` (GET/POST/PUT) y `questions/import` |
| Planes y productos | `/planes` | admin | `features`, `plans` (GET/POST/PUT/DELETE) |

«Usuarios y soporte» agrupa en pestañas los usuarios (con filtros y paginación por cursor),
los tickets (gestión completa vía PATCH) y las solicitudes de recorrección
(confirmar otorga 250 badges de bronce y admite `questionPatch`).

## Puesta en marcha (desarrollo local)

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
```
Elige una opción de base de datos en `.env`:

- **Firestore real:** define `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json` (cuenta de servicio de tu proyecto Firebase) y `GCLOUD_PROJECT`.
- **Emulador local (sin credenciales):** deja `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` y, en otra terminal:
  ```bash
  npm run emulator      # requiere firebase-tools + Java
  ```

Luego siembra datos y arranca:
```bash
npm run seed     # carga planes, usuarios, sponsors, métricas, etc.
npm start        # API en http://localhost:4000/api/v1
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173  (proxy /api -> :4000)
```

## Usuarios de prueba (sembrados)
| Correo | Contraseña | Rol | MFA |
|---|---|---|---|
| admin@aprueba.cl | admin123 | admin (todo) | otp 123456 |
| finance@aprueba.cl | finance123 | finance (comercial/sponsors) | otp 123456 |
| ops@aprueba.cl | ops123 | ops (operativa) | — |
| support@aprueba.cl | support123 | support (usuarios/tickets) | — |

El menú lateral y el acceso a cada vista se filtran según el rol (gating en frontend + backend `requireRole`).

## Endpoints de administración implementados
`POST /admin/auth/login`, `POST /admin/auth/refresh`,
`GET /admin/metrics/overview`, `GET /admin/metrics/commercial`,
`GET|POST|PATCH|DELETE /admin/sponsors`,
`GET /admin/platforms`, `GET /admin/services`, `GET /admin/containers`, `POST /admin/containers/:name/restart`,
`GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id`,
`GET|PATCH /admin/tickets`, `GET|PATCH /admin/corrections`,
`GET|POST|PUT /admin/questions`, `POST /admin/questions/import`,
`GET /admin/features`, `GET|POST|PUT|DELETE /admin/plans`,
`GET|POST /admin/tutors`, `GET|PUT|DELETE /admin/tutors/:id`,
`PATCH /admin/tutors/:id/verification`, `DELETE /admin/tutors/:id/reviews/:reviewId`.

Todos respetan el envelope, los roles y los códigos de error del documento de API.
**El frontend consume los 33 endpoints administrativos** (más los 2 de auth): no queda
funcionalidad de backend sin interfaz.

## Notas de consistencia frontend ↔ backend

- **`GET /admin/metrics/overview`** acepta los cuatro roles administrativos. «Resumen» es la
  portada de la consola para todos ellos; con `requireRole('admin')` finance/ops/support
  entraban a un 403.
- **Pausar un tutor** se hace con `PUT /admin/tutors/:id` (`status: 'paused'`, `featured: false`)
  y no con el `DELETE` «suave», porque ese DELETE exige rol `admin` mientras el resto de la
  gestión de tutores es de soporte. El `DELETE ?hard=true` (borrado definitivo) sí se reserva
  a gerencia y el botón solo aparece para ese rol.
- **La valoración de un tutor nunca se envía desde el cliente.** El formulario edita
  `ratingSeed` + `reviewCountSeed` y el backend deriva `rating`/`reviewCount`. Los tres
  criterios (`teaching`, `punctuality`, `mastery`) viajan siempre juntos o como `null`,
  porque la validación del API rechaza un `ratingSeed` parcial.
- **La verificación** usa el endpoint dedicado `PATCH /admin/tutors/:id/verification` en vez
  del campo `verified` del PUT, para que queden registrados `verifiedAt`, `verifiedBy` y la nota.
- **Alta vs. edición de sponsors:** `POST` recibe el array `benefits` y deriva
  `benefitsOffered`; `PATCH` solo acepta el total. El formulario refleja esa asimetría
  (lista de beneficios al crear, número al editar).
- **Pendiente en el backend (fuera del alcance de este cambio):** el seed no crea tutores,
  reseñas ni solicitudes de contacto, así que la vista de Tutores arranca vacía hasta que se
  dé de alta el primero desde la consola o se siembren esas colecciones.

## Despliegue en Vercel (frontend + backend en un solo proyecto)

El repo está preparado para desplegarse como **un único proyecto de Vercel**: el frontend
se construye como sitio estático (`frontend/dist`) y el backend Express se sirve como
función serverless en `api/index.js` (reexporta `backend/src/app.js`, sin `app.listen`).
`vercel.json` en la raíz define el build y el rewrite `/api/:path*` → la función, así que
el cliente (`frontend/src/api/client.js`) sigue llamando a rutas relativas (`/api/v1/...`)
sin cambios entre desarrollo y producción.

1. `vercel login` (una vez) y luego, desde la raíz del repo: `vercel link` para asociarlo a un proyecto de Vercel.
2. Define las variables de entorno del proyecto en Vercel (Settings → Environment Variables), no en un archivo:
   - `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`
   - `GCLOUD_PROJECT`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — el JSON completo de la cuenta de servicio de Firebase, pegado como una sola línea. **No** se sube el archivo `serviceAccount.json` al repo (es público); esta variable es la forma segura de dar credenciales reales en producción.
3. Despliega con `vercel --prod` (o conecta el repo de GitHub desde el dashboard de Vercel para que cada push a `main` dispare un deploy automático).

Como el repositorio es **público**, nunca commitear `.env`, `serviceAccount.json` ni ningún
secreto — el `.gitignore` de la raíz ya los excluye junto con `node_modules`, `dist` y `.vercel`.
