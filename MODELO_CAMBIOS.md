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
