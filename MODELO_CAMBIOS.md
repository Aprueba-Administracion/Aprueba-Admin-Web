# Cambios al modelo de datos

## Colección `plans` — nuevo campo `badges` (badges por acción)
Se añadió a cada documento de plan un objeto `badges` que define cuántos badges
otorga el plan por cada acción del alumno. Esto materializa el bloque
"Badges por acción" agregado al wireframe de administración.

```jsonc
// plans/{planId}
{
  "name": "Todas las pruebas",
  "price": 5,
  "color": "#F5B041",
  "features": ["f1","f2","f3","f4","f5","f6","f7","f8"],
  "limits": { "qDay": 0, "groups": 0, "tests": 99 },   // existente
  "badges": {                                          // NUEVO
    "login":    2,   // badges por login diario
    "purchase": 10,  // badges por la compra del plan (una vez)
    "correct":  2    // badges por cada respuesta correcta diaria
  }
}
```

### Impacto en la API
- `GET /admin/plans` ahora devuelve `badges` en cada plan.
- `POST /admin/plans` y `PUT /admin/plans/:id` aceptan y persisten `badges`
  (normalizado a enteros ≥ 0; ausente ⇒ `{login:0,purchase:0,correct:0}`).

### Consumo desde los servicios del alumno
Los servicios que ya emiten medallas deben leer `plans/{plan}.badges` para decidir
la cantidad a otorgar, en lugar de las constantes fijas previas:
- **Login diario:** sustituye "1 medalla de bronce/día" por `badges.login`.
- **Respuesta correcta:** sustituye "+1 medalla/acierto" por `badges.correct`.
- **Compra del plan:** otorga `badges.purchase` una sola vez al activarse la suscripción.

> Nota: la recorrección confirmada sigue otorgando 250 medallas de bronce
> (regla global, no por plan), según el documento de API.

---

## Colecciones `tutors`, `tutorReviews`, `tutorRequests` — administradas desde la consola

El marketplace de tutores lo lee la app del alumno (`GET /tutors`) y lo escribe la consola de
administración. La vista **Tutores** cubre el ciclo completo:

```jsonc
// tutors/{tutorId}
{
  "name": "Maria Valdes",
  "initials": "MV", "avatarColor": "#1A365D", "textColor": "#FFFFFF",
  "subjects": ["m1", "m2"],
  "subjectsLabel": { "es": "Matemática M1·M2", "en": "Math M1·M2" },
  "modes": ["online", "in_person"],
  "modesLabel": { "es": "Online · Presencial", "en": "Online · In-person" },
  "pricePerHour": 12000, "currency": "CLP", "country": "CL", "languages": ["es"],
  "bio": { "es": "…", "en": "…" }, "yearsExperience": 5,
  "verified": true, "featured": true, "online": false,   // `online` lo gestiona la app
  "ratingSeed": { "teaching": 4.9, "punctuality": 4.8, "mastery": 5.0 },
  "reviewCountSeed": 128,
  "rating": 4.9, "reviewCount": 128,                     // DERIVADOS: nunca se envían
  "contact": { "email": "…", "whatsapp": "…" }, "contactSharingDefault": true,
  "status": "active",                                    // active | paused | rejected
  "verificationNote": "…", "verifiedAt": "…", "verifiedBy": "adm_4",
  "createdAt": "…"
}
```

### Reglas que respeta la consola
- `rating` y `reviewCount` son **campos derivados**: la interfaz edita solo `ratingSeed` y
  `reviewCountSeed`, y el backend recalcula la reputación publicada combinándolos con las
  reseñas reales (misma agregación que `lib/tutors.js` del API del alumno).
- `ratingSeed` viaja con los tres criterios o como `null`; la validación del API rechaza
  un objeto parcial.
- La verificación se cambia con `PATCH /admin/tutors/:id/verification`, que además persiste
  `verifiedAt`, `verifiedBy` y `verificationNote`.
- Retirar un tutor de la app es `status: 'paused'` (+ `featured: false`); el borrado
  definitivo (`DELETE ?hard=true`) queda reservado a gerencia.
- Moderar una reseña (`DELETE /admin/tutors/:id/reviews/:reviewId`) recalcula la reputación.

---

## Alineamiento con el modelo canónico de Max (Wellq Co / Alloxentric)

Max entregó dos documentos v1.0 (septiembre 2026) que fijan la nomenclatura canónica de
colecciones/campos para el módulo de administración: `Aprueba_Admin_API_FastAPI.docx` y
`Aprueba_Admin_Modelo_Datos_Firestore.docx`. **El contrato HTTP (rutas `/api/v1/admin/*`,
envelope `{data,error,meta}`, roles `admin/finance/ops/support`) no cambia y ya lo
cumplíamos**; lo que cambian son nombres internos de colecciones y campos en Firestore.
El Firebase del proyecto **sí tiene datos reales que hay que cuidar** — Max lo entregó
ya cargado con esa información, no es solo el seed de prueba. Por eso cada fase se aplica
con un script de migración propio (Node.js, coherente con nuestro backend Express) que lee
los documentos existentes y los reestructura preservando sus valores, en vez de borrar y
volver a sembrar.

| # | Concepto | Antes | Canónico (Max) | Estado |
| --- | --- | --- | --- | --- |
| 1 | Tickets de soporte | `tickets` / campo `state` | `supportTickets` / campo `status` | Pendiente |
| 2 | Métricas (Resumen/Comercial) | `metrics/{overview,commercial}` con factor de escala sintético | `metricsDaily` / `metricsMonthly` (agregados reales) | Pendiente (baja prioridad: aún no hay pipeline real de eventos) |
| 3 | Beneficios de sponsors | array `benefits[]` embebido en el doc del sponsor | colección raíz `benefits` con `sponsorId` | **Hecho** (backend + migración, ver detalle abajo) |
| 4 | Medallas de alumnos | campo numérico `users.badges` | subcolección `users/{uid}/medalLedger` | Pendiente |
| 5 | Servicios / contenedores | colecciones `services` y `containers` | `serviceStatus` (snapshot) + `opsConfig` (config); contenedores en vivo desde Cloud Run | Pendiente |
| 6 | Recorrecciones | campo `state`, `reason` texto libre | campo `status`, `reason` enum + `comment` | Pendiente |
| 7 | Usuarios admin | campo de deshabilitación propio | campo `active` | Pendiente |
| 8 | Planes | `price` número plano, nombres sin i18n | `price {monthly, yearly}`, `name {es, en}` | Pendiente |

Orden de trabajo acordado: (1) sponsors/beneficios → (2) tickets/recorrecciones →
(3) usuarios/medallas/planes → (4) métricas/operativa. Detalle completo, archivos
afectados y decisiones en el plan compartido con el equipo.

### Fase 1 — Beneficios de sponsors (completada)

Se corrió `npm run migrate:sponsor-benefits` (con `--dry-run` primero) sobre el
Firebase real. Diagnóstico: de los 5 sponsors, **ninguno tenía beneficios detallados
reales** — solo los números resumen `benefitsOffered`/`benefitsRedeemed` (igual que el
seed). Es decir, no había beneficios individuales que perder; el riesgo inicial que nos
hizo escribir un migrador no destructivo no se materializó, pero igual sirvió para
confirmarlo sin arriesgar nada.

Para no dejar la colección nueva vacía, el script reconstruyó **un beneficio
"placeholder" por sponsor** a partir de esos totales (`name: "Beneficio general
(migrado, revisar)"`, `costPlatino: 0`, marcado con `placeholder: true` y una nota) —
el costo en Platino no existe en ningún lado, así que queda pendiente que finanzas lo
complete manualmente en la UI. El array `benefits`/los totales originales en
`sponsors/{id}` no se tocaron.

Backend actualizado para usar la colección nueva:
- `data/repo.js`: `COL.benefits = 'benefits'` + helper `listWhere(col, field, value)`.
- `routes/sponsors.js`: todas las rutas (`GET/POST /sponsors`, `PUT .../benefits`,
  `POST .../benefits/:id/redeem`, `DELETE /sponsors/:id`) ahora leen/escriben en
  `benefits` en vez del array embebido.

Script de migración: `backend/src/scripts/migrate-sponsor-benefits.js`
(`npm run migrate:sponsor-benefits -- --dry-run` / sin el flag para escribir).

#### Corrección — esquema al pie de la letra del documento de Max

La primera pasada de la Fase 1 usaba nombres/ids propios (`costPlatino`, `redeemed`,
id `<sponsorId>__<benefitId>`) en vez de los que define
`Aprueba_Admin_Modelo_Datos_Firestore.docx` para `benefits/{benefitId}`. Se corrigió:

| Campo | Antes | Ahora (Max) |
| --- | --- | --- |
| Id del documento | `<sponsorId>__<benefitId>` | `bnf_` + 10 hex |
| Costo | `costPlatino` | `costPlatinum` |
| Canjes acumulados | `redeemed` | `redeemedCount` |
| Activo/inactivo | (no existía) | `active` (boolean; `false` al agotar stock) |
| Sponsor denormalizado | (no existía) | `sponsorName` |
| Descripción / ícono | (no existían) | `description`, `icon` (sin UI todavía, quedan en `null`) |
| Fechas | (no se guardaban) | `createdAt` / `updatedAt` |
| `sponsors.benefitsOffered` | suma de stock+redeemed | cantidad de beneficios **activos** |

Se actualizó `routes/sponsors.js`, y en el frontend `BenefitItemForm.jsx` y
`Sponsors.jsx` (formulario y tabla ahora usan `costPlatinum`/`redeemedCount`).

Los 4 documentos placeholder que ya existían en Firestore (creados por nosotros
mismos en el paso anterior, no datos de Max) se corrigieron con
`backend/src/scripts/fix-benefits-schema.js`
(`npm run fix:benefits-schema -- --dry-run` / sin el flag para escribir).

#### Corrección — borrado lógico y campos faltantes de `sponsors`

La corrección anterior dejó fuera los campos que el documento de Max agrega a
`sponsors` en sí (no a `benefits`): `nameLower`, `contactEmail`, `deletedAt`,
`createdBy`/`updatedBy`, y el reemplazo del borrado físico por borrado lógico.
Ya está cerrado:

| Campo / comportamiento | Antes | Ahora (Max) |
| --- | --- | --- |
| `nameLower` | (no existía) | se guarda en minúsculas al crear/editar, para búsqueda case-insensitive |
| `contactEmail` | (no existía) | nullable; sin UI todavía (igual que `description`/`icon` en beneficios) |
| `createdBy` / `updatedBy` | (no existían) | id del admin autenticado (`req.user.id`), se setean en cada creación/edición |
| `DELETE /sponsors/:id` | borrado físico + cascada de borrado en `benefits` | borrado lógico: `deletedAt` (timestamp) en el sponsor, cascada de `benefits.active = false` (los documentos de beneficios ya no se borran) |
| `GET /sponsors` | devolvía todos los documentos | filtra los que tienen `deletedAt` (ya no aparecen en la consola) |

Los sponsors que ya existían en Firestore (creados antes de esta corrección)
no tenían estos campos nuevos. Se backfillean con
`backend/src/scripts/backfill-sponsor-fields.js`
(`npm run backfill:sponsor-fields -- --dry-run` / sin el flag para escribir);
es no destructivo — solo agrega (`merge:true`) los campos que falten
(`nameLower` derivado del `name` actual, el resto en `null`), sin tocar nada
más del documento.

**Sigue pendiente:** no hay UI todavía para editar `contactEmail`, para
`stock` ilimitado (`stock: null` según Max) ni para `description`/`icon` de
un beneficio.
