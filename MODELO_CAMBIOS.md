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
| 1 | Tickets de soporte | `tickets` / campo `state` | `supportTickets` / campo `status` | **Hecho** (ver detalle abajo) |
| 2 | Métricas (Resumen/Comercial) | `metrics/{overview,commercial}` con factor de escala sintético | `metricsDaily` / `metricsMonthly` (agregados reales) | Pendiente (baja prioridad: aún no hay pipeline real de eventos) |
| 3 | Beneficios de sponsors | array `benefits[]` embebido en el doc del sponsor | colección raíz `benefits` con `sponsorId` | **Hecho** (backend + migración, ver detalle abajo) |
| 4 | Medallas de alumnos | campo numérico `users.badges` | subcolección `users/{uid}/medalLedger` | Pendiente |
| 5 | Servicios / contenedores | colecciones `services` y `containers` | `serviceStatus` (snapshot) + `opsConfig` (config); contenedores en vivo desde Cloud Run | Pendiente |
| 6 | Recorrecciones | campo `state`, `reason` texto libre | campo `status`, `reason` enum + `comment` | **Hecho** (ver detalle abajo) |
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

### Fase 2, ítems #1 y #6 — Tickets de soporte y Recorrecciones (completada)

A diferencia de sponsors/beneficios (Fase 1), acá **no hizo falta un script de
migración**: tanto `tickets` (renombrada a `supportTickets`) como `corrections`
solo tenían datos de prueba cargados por `seed.js`, sin registros reales en el
Firebase del proyecto que hubiera que preservar. Por eso el cambio se aplicó
directamente sobre el seed y el código, y se resuelve simplemente volviendo a
correr `npm run seed`.

**Tickets de soporte:**
- `data/repo.js`: `COL.tickets` ahora apunta a la colección `supportTickets`
  (antes `tickets`).
- `routes/tickets.js`: filtro de `GET /tickets` y el arreglo `allowed` de
  `PATCH /tickets/:id` usan `status` en vez de `state`.
- `seed/seed.js`: los 5 tickets de ejemplo ahora usan la clave `status`
  (mismos valores: `open`/`progress`/`closed`).
- `frontend/pages/Users.jsx`: filtros, cálculo de `openTickets`, la tabla y
  el diálogo de edición del ticket (`TicketDialog`) leen/escriben `status`.

**Recorrecciones:**
- `routes/corrections.js`: filtro de `GET /corrections`, el `PATCH` de
  resolución y la respuesta usan `status` en vez de `state`.
- `seed/seed.js`: las 2 recorrecciones de ejemplo usan la clave `status`
  (mismos valores: `pending`). El enum de `reason` (`wrong_answer`, `typo`,
  etc.) + campo `comment` separado **ya estaba implementado** desde antes,
  no requirió cambios.
- `frontend/pages/Users.jsx`: filtros, cálculo de `pendingCor`, la tabla y
  el botón de resolución leen `status`.

> Importante: `state` también se usa en `Users.jsx` para el **estado de la
> cuenta de usuario** (activo/suspendido/dado de baja — `USER_STATES`,
> `x.state` en las filas de usuarios, `UserDialog`). Ese es un concepto
> distinto y no forma parte de este cambio; se dejó exactamente igual.

**Siguiente paso para ver el cambio reflejado:** correr `npm run seed`
nuevamente para que Firestore tenga los documentos con la colección/campo
nuevos.

### Fase 2 — ampliación al modelo completo del documento de Max (completada)

El corte anterior (rename `state`→`status` + `tickets`→`supportTickets`) fue
deliberadamente parcial. Max indicó que tomáramos la decisión que más nos
convenga, y con Amaru acordamos hacerlo tal cual el documento
`Aprueba_Admin_Modelo_Datos_Firestore.docx` para evitar problemas de
implementación más adelante. Esta ampliación agrega **todos** los campos y
el comportamiento que faltaban en `supportTickets` y `corrections`.

**`supportTickets/{id}` — campos nuevos:**
`number` (secuencial, vía transacción `counters/ticketNumber` —
`repo.js: nextTicketNumber()`), `subjectLower`, `category` (enum
`login|payments|content|account|other`, solo la crea la app del alumno; el
admin **no** la edita, igual que en el documento de endpoints), `userEmail`,
`priorityRank` (derivado de `priority`), `assigneeName` (denormalizado de
`adminUsers`), `channel` (`app|web|email`), `messagesCount`, `lastMessageAt`,
`closedAt`. El campo `age` ("2 h", "1 d") **ya no se guarda**: `routes/
tickets.js` lo calcula en cada respuesta a partir de `createdAt`/`closedAt`
(`withAge()`), tal como pide el documento.

**Subcolección `supportTickets/{id}/messages/{messageId}`** (nueva):
`authorType` (`user|agent|system`), `authorId`/`authorName`, `body`,
`internal` (notas internas, no visibles para el alumno), `createdAt`,
`expiresAt` (TTL: se fija a `closedAt + 2 años` en todos los mensajes al
cerrar el ticket, y se limpia al reabrir).

**`PATCH /admin/tickets/:id`** — reescrito para igualar la lógica del
documento de endpoints (`api.txt`), adaptada al contrato HTTP plano que ya
usa este proyecto (sin envolver `user`/`assignee` en objetos anidados, que
es lo único que ese documento cambia y que ya habíamos decidido no tocar):
- Transiciones de estado válidas: `open→progress`, `open→closed`,
  `progress→closed`, `closed→open`; cualquier otra combinación devuelve
  `409 INVALID_STATE_TRANSITION` (p. ej. `progress→open` NO está permitida).
- `assigneeId` se valida contra `adminUsers` (debe existir con rol `support`
  o `admin`); si no, `422 ASSIGNEE_INVALID`. `assigneeId: null` desasigna.
- `reply` crea un mensaje `agent` visible para el alumno; si el ticket
  estaba `open` y no se pidió cambio de estado, pasa solo a `progress`; si
  no tenía asignado, se autoasigna al agente que responde.
- `internalNote` (campo nuevo, separado de `reply`) crea un mensaje `agent`
  con `internal: true`.
- Reabrir (`closed→open`) crea un mensaje `system` ("Ticket reabierto") y
  limpia el TTL de los mensajes existentes.
- La operación es atómica (un solo `batch`: update del ticket + mensajes +
  `messagesCount` incremental).

**`GET /admin/tickets`** — devuelve `meta.openCount` (tickets no cerrados,
para el badge del menú) y admite filtros `status`, `priority`,
`assigneeId` (incl. `unassigned`), `userId`, búsqueda `q` (por
`subjectLower` o por número) y `sort`. **No implementa paginación por
cursor** (el proyecto no la tenía para tickets y el volumen de datos de este
capstone no lo justifica); si en algún momento se necesita, es una extensión
aparte.

**`GET /admin/tickets/:id`** (nuevo endpoint) — devuelve el ticket completo
más su hilo de mensajes (`supportTickets/{id}/messages`, orden ascendente
por `createdAt`, máx. 200). El frontend lo usa para abrir el detalle del
ticket.

**`corrections/{id}` — campos nuevos:**
`questionTestId`, `questionAxis`, `questionDifficulty`, `questionStatement`
(recortado a 120 caracteres) — denormalizados de la pregunta al momento de
la solicitud, así la cola de recorrecciones se puede mostrar sin permiso de
gerencia; `proposedAnswer`; `potentialReward` (`{tier, amount}`, la regla
fija de 250 medallas de bronce); `rewardGranted` ahora se persiste en el
documento (antes solo viajaba en la respuesta); `questionPatch` (copia de lo
aplicado); `note` (nota del revisor, visible al alumno); `resolvedByName`.
`GET /admin/corrections` ahora expone `meta.pendingCount` y acepta
`status=all`. El `PATCH` rechaza con `409 ALREADY_RESOLVED` si la solicitud
ya no está `pending` (evita otorgar la recompensa dos veces).

**Frontend (`Users.jsx`):**
- Tabla de tickets: columna de número (`#1042`) en vez del id interno,
  categoría bajo el asunto, antigüedad calculada (`ageLabel`).
- `TicketDialog` ahora es un panel de detalle completo: pide
  `GET /tickets/:id` al abrir, muestra el hilo de mensajes (con distinción
  visual para notas internas), permite responder al alumno y agregar una
  nota interna por separado, cambiar estado/prioridad/asignado, y muestra
  categoría/canal/correo del alumno y fecha de cierre.
- `CorrectionDialog`: muestra la respuesta propuesta por el alumno y un
  campo de nota del revisor; usa `questionStatement` denormalizado como
  respaldo cuando el rol no tiene acceso a `/questions`.
- Nuevas clases CSS `.msg-thread`/`.msg` en `styles.css` para el hilo.
- `i18n.js`: se corrigieron las claves de `reason` (el enum real es
  `wrong_answer|ambiguous|typo|bad_explanation|other`; antes faltaban
  `reason_ambiguous` y `reason_bad_explanation`, y sobraba `reason_unclear`)
  y se agregaron las claves de categoría/canal/hilo de mensajes.

**`seed/seed.js`** — reescrito para el modelo completo: IDs de ticket y de
mensaje **fijos** (no aleatorios) para que `npm run seed` siga siendo
idempotente (sobrescribe los mismos documentos en vez de acumular
duplicados en cada corrida); el contador `counters/ticketNumber` queda
sembrado en el número máximo sembrado (1042), listo para que el próximo
ticket real (creado por la app del alumno, fuera del alcance del admin)
saque el siguiente número con `nextTicketNumber()`.

**Deliberadamente fuera de este alcance** (para no invadir otros ítems de
la tabla de Fase 2 más arriba):
- Ítem **#4** (medallas): el documento describe que confirmar una
  recorrección también debería escribir en una subcolección
  `users/{uid}/medalLedger`. Esto sigue usando el campo plano
  `users.badges`, tal como estaba, porque la migración de medallas a
  subcolección es su propio ítem pendiente en la tabla (no forma parte de
  tickets/recorrecciones).
- No se agregó ningún endpoint nuevo para listar agentes (`adminUsers`)
  para el selector de "asignado a"; se mantiene el campo de texto libre
  con el ID del agente, igual que antes.
