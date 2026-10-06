// Prueba de humo del backend contra el EMULADOR de Firestore (no gasta cuota).
// Uso (con el emulador y el seed ya corridos):
//   npm run emulator        # terminal 1
//   npm run seed:emu        # terminal 2 (una vez)
//   npm run smoke           # terminal 2
// Se niega a correr si FIRESTORE_EMULATOR_HOST no está definido.
import 'dotenv/config';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('[smoke] BLOQUEADO: define FIRESTORE_EMULATOR_HOST (usa "npm run smoke" con el emulador arriba).');
  process.exit(1);
}
process.env.JWT_SECRET ||= 'smoke-secret';

const { default: app } = await import('../app.js');
const { db } = await import('../data/repo.js');

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}/api/v1/admin`;

let pass = 0; const fails = [];
const section = (t) => console.log(`\n== ${t}`);
function check(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  ✓ ${name}`); }
  else { fails.push(name); console.log(`  ✗ ${name} ${extra}`); }
}
async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204 */ }
  return { status: res.status, data: json?.data, error: json?.error, meta: json?.meta };
}
async function login(email, password, otp) {
  const r = await call('POST', '/auth/login', { body: { email, password, otp } });
  return r.data?.accessToken;
}

try {
  section('Login y roles');
  const bad = await call('POST', '/auth/login', { body: { email: 'admin@aprueba.cl', password: 'mala', otp: '123456' } });
  check('contraseña incorrecta → 401', bad.status === 401);
  const noOtp = await call('POST', '/auth/login', { body: { email: 'admin@aprueba.cl', password: 'admin123' } });
  check('admin sin OTP → 401 AUTH_MFA_REQUIRED', noOtp.status === 401 && noOtp.error?.code === 'AUTH_MFA_REQUIRED');
  const admin = await login('admin@aprueba.cl', 'admin123', '123456');
  const finance = await login('finance@aprueba.cl', 'finance123', '123456');
  const ops = await login('ops@aprueba.cl', 'ops123');
  const support = await login('support@aprueba.cl', 'support123');
  check('los 4 roles obtienen token', !!(admin && finance && ops && support));
  check('sin token → 401', (await call('GET', '/users')).status === 401);
  check('ops no puede ver usuarios → 403', (await call('GET', '/users', { token: ops })).status === 403);
  check('support no puede ver sponsors → 403', (await call('GET', '/sponsors', { token: support })).status === 403);

  section('Usuarios admin (#7: active, emailLower, bloqueo)');
  const adm = (id) => db.collection('adminUsers').doc(id);
  const a1 = (await adm('adm_1').get()).data();
  check('adminUsers con emailLower, active:true, createdAt', a1.emailLower === 'admin@aprueba.cl' && a1.active === true && !!a1.createdAt);
  check('login exitoso fija lastLoginAt y reinicia failedLoginCount', !!a1.lastLoginAt && a1.failedLoginCount === 0);
  const upper = await call('POST', '/auth/login', { body: { email: 'ADMIN@Aprueba.cl', password: 'admin123', otp: '123456' } });
  check('login es case-insensitive en el correo (emailLower)', upper.status === 200);
  const opsLogin = await call('POST', '/auth/login', { body: { email: 'ops@aprueba.cl', password: 'ops123' } });
  await adm('adm_3').update({ active: false });
  const disabled = await call('POST', '/auth/login', { body: { email: 'ops@aprueba.cl', password: 'ops123' } });
  check('cuenta con active=false → 403 ACCOUNT_DISABLED', disabled.status === 403 && disabled.error?.code === 'ACCOUNT_DISABLED');
  const disabledBad = await call('POST', '/auth/login', { body: { email: 'ops@aprueba.cl', password: 'mala' } });
  check('contraseña mala en cuenta deshabilitada sigue siendo 401 (no revela la cuenta)', disabledBad.status === 401);
  const refDis = await call('POST', '/auth/refresh', { body: { refreshToken: opsLogin.data.refreshToken } });
  check('refresh con cuenta deshabilitada → 403 ACCOUNT_DISABLED', refDis.status === 403 && refDis.error?.code === 'ACCOUNT_DISABLED');
  await adm('adm_3').update({ active: true, failedLoginCount: 0 });
  const refOk = await call('POST', '/auth/refresh', { body: { refreshToken: opsLogin.data.refreshToken } });
  check('al reactivar, el refresh vuelve a funcionar', refOk.status === 200 && !!refOk.data.accessToken);
  await adm('adm_1').update({ active: false });
  const agents = await call('GET', '/agents', { token: support });
  check('un admin deshabilitado no aparece en /agents', agents.status === 200 && !agents.data.some((a) => a.id === 'adm_1'));
  await adm('adm_1').update({ active: true });
  for (let i = 0; i < 10; i += 1) await call('POST', '/auth/login', { body: { email: 'ops@aprueba.cl', password: 'incorrecta' } });
  const locked = await call('POST', '/auth/login', { body: { email: 'ops@aprueba.cl', password: 'ops123' } });
  check('10 fallos → cuenta bloqueada, aun con contraseña correcta → 423 ACCOUNT_LOCKED', locked.status === 423 && locked.error?.code === 'ACCOUNT_LOCKED');
  await adm('adm_3').update({ lockedUntil: null, failedLoginCount: 0 });
  const unlocked = await call('POST', '/auth/login', { body: { email: 'ops@aprueba.cl', password: 'ops123' } });
  check('al vencer/limpiar el bloqueo vuelve a entrar', unlocked.status === 200);

  section('Tickets');
  const list = await call('GET', '/tickets', { token: support });
  check('lista tickets (≥5) con meta.openCount', list.status === 200 && list.data.length >= 5 && typeof list.meta.openCount === 'number');
  const open = list.data.find((t) => t.status === 'open' && !t.assigneeId);
  check('hay un ticket abierto sin asignar para probar', !!open);
  const bogus = await call('PATCH', `/tickets/${open.id}`, { token: support, body: { assigneeId: 'adm_inventado' } });
  check('assignee inventado → 422 ASSIGNEE_INVALID', bogus.status === 422 && bogus.error?.code === 'ASSIGNEE_INVALID');
  await adm('adm_1').update({ active: false });
  const toDisabled = await call('PATCH', `/tickets/${open.id}`, { token: support, body: { assigneeId: 'adm_1' } });
  check('asignar a un agente deshabilitado → 422 ASSIGNEE_INVALID', toDisabled.status === 422 && toDisabled.error?.code === 'ASSIGNEE_INVALID');
  await adm('adm_1').update({ active: true });
  const assigned = await call('PATCH', `/tickets/${open.id}`, { token: support, body: { assigneeId: 'adm_4', reply: 'Hola, lo revisamos.', internalNote: 'nota interna' } });
  check('asignar + responder + nota → pasa a progress', assigned.status === 200 && assigned.data.status === 'progress');
  const detail = await call('GET', `/tickets/${open.id}`, { token: support });
  const msgs = detail.data?.messages || [];
  check('reply (público) y nota (internal) quedan separadas', msgs.some((m) => !m.internal && m.body.startsWith('Hola')) && msgs.some((m) => m.internal));
  const back = await call('PATCH', `/tickets/${open.id}`, { token: support, body: { status: 'open' } });
  check('progress → open → 409 INVALID_STATE_TRANSITION', back.status === 409 && back.error?.code === 'INVALID_STATE_TRANSITION');
  const closed = await call('PATCH', `/tickets/${open.id}`, { token: support, body: { status: 'closed' } });
  check('progress → closed OK, con closedAt', closed.status === 200 && closed.data.status === 'closed' && !!closed.data.closedAt);
  const m2 = (await call('GET', `/tickets/${open.id}`, { token: support })).data.messages;
  check('al cerrar, los mensajes reciben expiresAt (TTL)', m2.length > 0 && m2.every((m) => !!m.expiresAt));
  const reopen = await call('PATCH', `/tickets/${open.id}`, { token: support, body: { status: 'open' } });
  check('closed → open OK', reopen.status === 200 && reopen.data.status === 'open');

  section('Recorrecciones');
  const cors = await call('GET', '/corrections?status=pending', { token: support });
  const pend = cors.data?.[0];
  check('hay recorrecciones pendientes + meta.pendingCount', cors.status === 200 && !!pend && typeof cors.meta.pendingCount === 'number');
  const before = (await call('GET', `/users/${pend.userId}`, { token: support })).data;
  const conf = await call('PATCH', `/corrections/${pend.id}`, { token: support, body: { resolution: 'confirmed', note: 'ok' } });
  check('confirmar → rewardGranted bronze 250', conf.status === 200 && conf.data.rewardGranted?.amount === 250);
  const after = (await call('GET', `/users/${pend.userId}`, { token: support })).data;
  check('el usuario sube 250 en badgesTotal y medals.bronze', after.badgesTotal === (before.badgesTotal || 0) + 250 && after.medals.bronze === (before.medals?.bronze || 0) + 250);
  const again = await call('PATCH', `/corrections/${pend.id}`, { token: support, body: { resolution: 'rejected' } });
  check('resolver de nuevo → 409 ALREADY_RESOLVED', again.status === 409 && again.error?.code === 'ALREADY_RESOLVED');
  const ledgerSnap = await db.collection('users').doc(pend.userId).collection('medalLedger').where('refId', '==', pend.id).get();
  const led = ledgerSnap.docs.map((d) => d.data());
  check('medalLedger: 1 asiento reward/bronze/250 con refId y by', led.length === 1 && led[0].event === 'reward' && led[0].tier === 'bronze' && led[0].amount === 250 && led[0].reason === 'correction_confirmed' && led[0].refType === 'correction' && !!led[0].by);
  check('resolver de nuevo NO duplica el asiento del ledger', (await db.collection('users').doc(pend.userId).collection('medalLedger').where('refId', '==', pend.id).get()).size === 1);
  const nf = await call('PATCH', '/corrections/cor_no_existe', { token: support, body: { resolution: 'confirmed' } });
  check('recorrección inexistente → 404', nf.status === 404);

  section('Usuarios');
  const users = await call('GET', '/users?limit=50', { token: support });
  check('lista usuarios con paginación', users.status === 200 && users.data.length > 0 && users.meta.pagination);
  const stats = await call('GET', '/users/stats', { token: support });
  check('/users/stats suma coherente', stats.status === 200 && stats.data.total === stats.data.active + stats.data.suspended + stats.data.churned);
  const uid = users.data.find((u) => u.state === 'active').id;
  const emailBefore = (await call('GET', `/users/${uid}`, { token: support })).data.email;
  const susp = await call('PATCH', `/users/${uid}`, { token: support, body: { state: 'suspended', reason: 'prueba smoke', email: 'hack@x.cl' } });
  check('suspender → suspension{reason,by,at} + sessionsRevokedAt + lastAdminAction', susp.status === 200 && susp.data.suspension?.reason === 'prueba smoke' && !!susp.data.sessionsRevokedAt && susp.data.lastAdminAction?.action === 'suspend');
  check('el campo email del body se IGNORA (solo pendingEmail)', susp.data.email === emailBefore);
  const react = await call('PATCH', `/users/${uid}`, { token: support, body: { state: 'active' } });
  check('reactivar → suspension null', react.status === 200 && react.data.suspension === null);
  const plan = await call('PATCH', `/users/${uid}`, { token: support, body: { plan: 'uni' } });
  check('cambiar plan → planSource = manual', plan.status === 200 && plan.data.planSource === 'manual');
  const found = await call('GET', '/users?q=camila', { token: support });
  check('búsqueda por nombre (case-insensitive)', found.data.length >= 1 && found.data.every((u) => u.nameLower.includes('camila')));

  section('Sponsors y beneficios');
  const sp = await call('GET', '/sponsors', { token: finance });
  check('lista sponsors con beneficios (seed)', sp.status === 200 && sp.data.length === 5 && sp.data.every((s) => s.benefits.length > 0));
  check('benefitsOffered coincide con beneficios activos', sp.data.every((s) => s.benefitsOffered === s.benefits.filter((b) => b.active !== false).length));
  const newSp = await call('POST', '/sponsors', { token: finance, body: { name: 'Sponsor Smoke', tier: 'Bronze', monthlyFee: 100, benefits: [{ name: 'Beneficio A', costPlatinum: 10, stock: 2 }] } });
  check('crear sponsor → 201 con id de beneficio bnf_', newSp.status === 201 && /^bnf_[0-9a-f]{10}$/.test(newSp.data.benefits[0].id));
  const sid = newSp.data.id; const bid = newSp.data.benefits[0].id;
  const doc = (await db.collection('sponsors').doc(sid).get()).data();
  check('doc sponsor tiene nameLower, deletedAt:null, createdBy', doc.nameLower === 'sponsor smoke' && doc.deletedAt === null && !!doc.createdBy);
  const red = await call('POST', `/sponsors/${sid}/benefits/${bid}/redeem`, { token: finance, body: { cantidad: 1 } });
  check('canjear → redeemedCount 1', red.status === 200 && red.data.benefits[0].redeemedCount === 1);
  const red2 = await call('POST', `/sponsors/${sid}/benefits/${bid}/redeem`, { token: finance, body: { cantidad: 5 } });
  check('canjear más que el stock → 400', red2.status === 400);
  const del = await call('DELETE', `/sponsors/${sid}`, { token: finance });
  check('baja de sponsor → 204', del.status === 204);
  const doc2 = (await db.collection('sponsors').doc(sid).get());
  check('borrado LÓGICO: el doc sigue existiendo con deletedAt', doc2.exists && !!doc2.data().deletedAt);
  const sp2 = await call('GET', '/sponsors', { token: finance });
  check('el sponsor dado de baja no aparece en la lista', !sp2.data.some((s) => s.id === sid));

  section('Planes y funcionalidades (#8: name {es,en}, price {monthly,yearly})');
  const feats = await call('GET', '/features', { token: admin });
  check('features canónicas: key, name {es,en}, icon, order', feats.status === 200 && feats.data.length === 10 && feats.data.every((f) => f.key && f.name?.es && f.name?.en && f.icon && f.order));
  const pl = await call('GET', '/plans', { token: admin });
  const planAll = pl.data?.find((p) => p.id === 'all');
  check('GET /plans en orden free, uni, all', pl.status === 200 && pl.data.slice(0, 3).map((p) => p.id).join() === 'free,uni,all');
  check('plan canónico: name {es,en}, nameLower, nameKey', planAll?.name?.es === 'Todas las pruebas' && planAll.name.en === 'All tests' && planAll.nameLower === 'todas las pruebas' && planAll.nameKey === 'pl_all');
  check('price {monthly, yearly}, currency, system, stripePriceIds', planAll.price.monthly === 5 && planAll.price.yearly === 48 && planAll.currency === 'USD' && planAll.system === true && 'monthly' in planAll.stripePriceIds);
  const putFree = await call('PUT', '/plans/free', { token: admin, body: { price: 3 } });
  check('plan free con precio > 0 → 422 FREE_PLAN_MUST_BE_FREE', putFree.status === 422 && putFree.error?.code === 'FREE_PLAN_MUST_BE_FREE');
  const delSys = await call('DELETE', '/plans/all', { token: admin });
  check('borrar plan de sistema → 422 PLAN_PROTECTED', delSys.status === 422 && delSys.error?.code === 'PLAN_PROTECTED');
  const legacy = await call('POST', '/plans', { token: admin, body: { name: 'Plan Smoke', price: 7.556, color: '#112233' } });
  check('crear con formato anterior (name string, price número) → canónico, id pl_xxxxxx', legacy.status === 201 && /^pl_[0-9a-f]{6}$/.test(legacy.data.id) && legacy.data.name.es === 'Plan Smoke' && legacy.data.name.en === 'Plan Smoke' && legacy.data.price.monthly === 7.56 && legacy.data.system === false);
  const pid = legacy.data.id;
  const dup = await call('POST', '/plans', { token: admin, body: { name: { es: 'plan smoke', en: 'Smoke plan' } } });
  check('nombre repetido (sin importar mayúsculas) → 409 PLAN_NAME_TAKEN', dup.status === 409 && dup.error?.code === 'PLAN_NAME_TAKEN');
  const badColor = await call('POST', '/plans', { token: admin, body: { name: 'Otro Plan', color: 'rojo' } });
  check('color inválido → 400 VALIDATION', badColor.status === 400);
  const badFeat = await call('PUT', `/plans/${pid}`, { token: admin, body: { features: ['f1', 'f_inexistente'] } });
  check('feature inexistente → 400 VALIDATION', badFeat.status === 400);
  const badLim = await call('PUT', `/plans/${pid}`, { token: admin, body: { limits: { qDay: 99999, groups: 0, tests: 1 } } });
  check('límite fuera de rango → 400 VALIDATION', badLim.status === 400);
  const upd = await call('PUT', `/plans/${pid}`, { token: admin, body: { name: { es: 'Plan Smoke 2', en: 'Smoke Plan 2' }, price: { monthly: 9, yearly: 80 }, features: ['f1', 'f2'], badges: { login: 3, purchase: 4, correct: 5 } } });
  check('PUT actualiza name/price/features/badges y fija updatedBy', upd.status === 200 && upd.data.name.en === 'Smoke Plan 2' && upd.data.price.yearly === 80 && upd.data.features.length === 2 && upd.data.badges.correct === 5 && upd.data.updatedBy === 'adm_1');
  const stale = await call('PUT', `/plans/${pid}`, { token: admin, body: { color: '#445566', updatedAt: legacy.data.updatedAt } });
  check('PUT con updatedAt desactualizado → 409 PLAN_CONFLICT', stale.status === 409 && stale.error?.code === 'PLAN_CONFLICT');
  const fresh = await call('PUT', `/plans/${pid}`, { token: admin, body: { color: '#445566', updatedAt: upd.data.updatedAt } });
  check('PUT con updatedAt vigente → 200', fresh.status === 200 && fresh.data.color === '#445566');
  const mono = await call('PUT', `/plans/${pid}`, { token: admin, body: { price: 10 } });
  check('precio como número solo cambia monthly y conserva yearly', mono.status === 200 && mono.data.price.monthly === 10 && mono.data.price.yearly === 80);
  const sUser = users.data.find((u) => u.state === 'active' && u.id !== uid) || users.data[0];
  await call('PATCH', `/users/${sUser.id}`, { token: support, body: { plan: pid } });
  const delSubs = await call('DELETE', `/plans/${pid}`, { token: admin });
  check('borrar plan propio con suscriptores activos → 409 PLAN_HAS_SUBSCRIPTIONS', delSubs.status === 409 && delSubs.error?.code === 'PLAN_HAS_SUBSCRIPTIONS');
  await call('PATCH', `/users/${sUser.id}`, { token: support, body: { plan: 'free' } });
  const delOk = await call('DELETE', `/plans/${pid}`, { token: admin });
  check('sin suscriptores, el plan propio se elimina → 204', delOk.status === 204);

  section('Operativa (#5: serviceStatus, opsConfig, opsRestarts)');
  check('support no puede ver contenedores → 403', (await call('GET', '/containers', { token: support })).status === 403);
  // Idempotencia: una corrida anterior deja opsRestarts cerrado y notif-worker "ok".
  // Se limpian antes de medir para que el smoke se pueda repetir sin re-sembrar.
  const oldRestarts = await db.collection('opsRestarts').get();
  await Promise.all(oldRestarts.docs.map((d) => d.ref.delete()));
  const svcs = await call('GET', '/services', { token: ops });
  check('services: 5 en orden login…notif, name {es,en}, uptimePct numérico', svcs.status === 200 && svcs.data.map((x) => x.key).join() === 'login,badges,questions,payments,notif' && svcs.data.every((x) => x.name?.es && x.name?.en && typeof x.uptimePct === 'number'));
  check('services: notif caído sin latencia; meta.cache = stale', svcs.data[4].state === 'down' && svcs.data[4].latencyMs === null && svcs.meta.cache === 'stale');
  const conts = await call('GET', '/containers', { token: ops });
  const cget = (n) => conts.data?.find((c) => c.name === n);
  check('containers: 8 con kind, region, restartable y métricas', conts.status === 200 && conts.data.length === 8 && conts.data.every((c) => c.kind && c.region && typeof c.restartable === 'boolean' && typeof c.cpu === 'number'));
  check('containers: marcados como datos simulados (meta.source)', conts.meta.source === 'simulated');
  check('notif-worker parte caído y db-primary no es reiniciable', cget('notif-worker').state === 'down' && cget('db-primary').restartable === false);
  const rs1 = await call('POST', '/containers/db-primary/restart', { token: ops });
  check('reiniciar un servicio no reiniciable → 422 NOT_RESTARTABLE', rs1.status === 422 && rs1.error?.code === 'NOT_RESTARTABLE');
  const rs2 = await call('POST', '/containers/no-existe/restart', { token: ops });
  check('reiniciar un contenedor inexistente → 404', rs2.status === 404);
  const rs3 = await call('POST', '/containers/notif-worker/restart', { token: ops, body: { reason: 'Cola atascada' } });
  check('reiniciar notif-worker → 202 con operationId', rs3.status === 202 && !!rs3.data.operationId);
  const rdoc = (await db.collection('opsRestarts').doc('notif-worker').get()).data();
  check('opsRestarts: requestedBy, reason, finishedAt null, TTL ≈ 30 días', rdoc.requestedBy === 'adm_3' && rdoc.reason === 'Cola atascada' && rdoc.finishedAt === null && Math.abs((rdoc.expiresAt.toMillis() - rdoc.requestedAt.toMillis()) / 86400000 - 30) < 0.01);
  const rs4 = await call('POST', '/containers/notif-worker/restart', { token: ops });
  check('segundo reinicio inmediato → 409 RESTART_IN_PROGRESS', rs4.status === 409 && rs4.error?.code === 'RESTART_IN_PROGRESS');
  const midC = await call('GET', '/containers', { token: ops });
  check('mientras reinicia: restarting = true y estado deg', midC.data.find((c) => c.name === 'notif-worker').restarting === true && midC.data.find((c) => c.name === 'notif-worker').state === 'deg');
  await db.collection('opsRestarts').doc('notif-worker').update({ requestedAt: new Date(Date.now() - 60000) });
  const endC = await call('GET', '/containers', { token: ops });
  const nw = endC.data.find((c) => c.name === 'notif-worker');
  check('pasado el tiempo el reinicio se cierra: estado ok y restarting = false', nw.state === 'ok' && nw.restarting === false);
  const svcAfter = await call('GET', '/services', { token: ops });
  const notifSvc = svcAfter.data.find((x) => x.key === 'notif');
  check('tras reiniciar notif-worker, el servicio Notificaciones deja de estar caído', notifSvc.state === 'ok' && notifSvc.consecutiveFailures === 0 && typeof notifSvc.latencyMs === 'number');
  const rdoc2 = (await db.collection('opsRestarts').doc('notif-worker').get()).data();
  check('opsRestarts cerrado: finishedAt, result ready, newRevision', !!rdoc2.finishedAt && rdoc2.result === 'ready' && !!rdoc2.newRevision);
  const rs5 = await call('POST', '/containers/notif-worker/restart', { token: ops });
  check('terminado el anterior se puede reiniciar de nuevo → 202', rs5.status === 202);
  const plats = await call('GET', '/platforms', { token: ops });
  check('platforms: ios, android, web con name, downloadsDelta y syncSource', plats.status === 200 && plats.data.map((x) => x.id).join() === 'ios,android,web' && plats.data.every((x) => x.name && typeof x.downloadsDelta === 'number' && x.syncSource));
  check('platforms: PWA con downloads null; meta.sync.stale = false', plats.data[2].downloads === null && plats.meta.sync.stale === false);

  section('Métricas (#2: metricsDaily / metricsMonthly)');
  const dsnap = await db.collection('metricsDaily').orderBy('date').get();
  const drows = dsnap.docs.map((d) => d.data());
  check('metricsDaily: 90 docs con date, downloads{total,ios,android,web}, mau, expiresAt', drows.length >= 90 && drows.every((d) => d.date && typeof d.downloads?.total === 'number' && typeof d.mau === 'number' && !!d.expiresAt));
  check('metricsDaily: id = date y downloads.total = ios + android + web', dsnap.docs.every((d) => d.id === d.data().date && d.data().downloads.total === d.data().downloads.ios + d.data().downloads.android + d.data().downloads.web));
  check('metricsDaily: badgesIssued.total = suma de niveles', drows.every((d) => d.badgesIssued.total === ['bronze', 'silver', 'gold', 'diamond', 'platinum'].reduce((s2, t) => s2 + d.badgesIssued[t], 0)));
  check('metricsDaily: revenueByPlan suma el MRR', drows.every((d) => Math.abs(d.revenueByPlan.uni + d.revenueByPlan.all - d.mrr) < 0.011));
  const msnap = await db.collection('metricsMonthly').get();
  const mrows = msnap.docs.map((d) => d.data());
  check('metricsMonthly: ≥ 24 meses con closed, daysAggregated y convRate', mrows.length >= 24 && mrows.every((m) => typeof m.closed === 'boolean' && m.daysAggregated > 0 && typeof m.convRate === 'number'));
  check('metricsMonthly: solo el mes en curso está abierto', mrows.filter((m) => !m.closed).length === 1);

  const ov30 = await call('GET', '/metrics/overview?range=30d', { token: support });
  check('overview 30d → 200 con meta.source synthetic y range', ov30.status === 200 && ov30.meta.source === 'synthetic' && ov30.meta.range === '30d');
  const lastDay = drows[drows.length - 1];
  const win30 = drows.filter((d) => d.date <= lastDay.date).slice(-30);
  check('overview 30d: downloads.month = suma de 30 días de metricsDaily', ov30.data.downloads.month === win30.reduce((s2, d) => s2 + d.downloads.total, 0));
  check('overview: downloads.total = acumulado del último día; MAU y MRR = último valor', ov30.data.downloads.total === lastDay.downloadsTotalToDate && ov30.data.mau.value === lastDay.mau && ov30.data.mrr.value === lastDay.mrr);
  check('overview: converted.rate = convertidos / MAU', ov30.data.converted.rate === Math.round((lastDay.convertedToDate / lastDay.mau) * 1000) / 10);
  const ov7 = await call('GET', '/metrics/overview?range=7d', { token: support });
  check('overview 7d suma menos descargas que 30d (el rango sí cambia el dato)', ov7.status === 200 && ov7.data.downloads.month < ov30.data.downloads.month);
  const ov90 = await call('GET', '/metrics/overview?range=90d', { token: ops });
  const ov12 = await call('GET', '/metrics/overview?range=12m', { token: ops });
  check('overview 90d y 12m (metricsMonthly): 12m > 90d en descargas', ov90.status === 200 && ov12.status === 200 && ov12.data.downloads.month > ov90.data.downloads.month);
  check('overview: 6 meses de downloadsByMonth con etiqueta y valor', ov30.data.downloadsByMonth.length === 6 && ov30.data.downloadsByMonth.every((m) => m.month && m.value > 0));
  check('overview: deltaPct numéricos', [ov30.data.downloads.deltaPct, ov30.data.mau.deltaPct, ov30.data.mrr.deltaPct].every((v) => typeof v === 'number' && Number.isFinite(v)));
  check('overview: sponsorsActive vivo (cuenta sponsors ok/deg sin baja)', ov30.data.sponsorsActive >= 1);
  const downSvcs = (await db.collection('serviceStatus').get()).docs.filter((d) => d.data().state === 'down').length;
  check('overview: systemHealth sale de serviceStatus (ya no es fijo)', ov30.data.systemHealth.servicesDown === downSvcs && ov30.data.systemHealth.status === 'degraded');
  check('overview: revenueByPlan en formato [{plan,value}]', ov30.data.revenueByPlan.length === 2 && ov30.data.revenueByPlan.every((p) => p.plan && typeof p.value === 'number'));
  const com = await call('GET', '/metrics/commercial?range=30d', { token: finance });
  check('commercial 30d → 200: funnel de 4 pasos desde los …ToDate', com.status === 200 && com.data.funnel.length === 4 && com.data.funnel[0].value === lastDay.downloadsTotalToDate && com.data.funnel[1].value === lastDay.registeredToDate && com.data.funnel[3].value === lastDay.convertedToDate);
  check('commercial: badgesByType con los 5 niveles y suma = badges del período', com.data.badgesByType.length === 5 && com.data.badgesByType.reduce((s2, b) => s2 + b.value, 0) === win30.reduce((s2, d) => s2 + d.badgesIssued.total, 0));
  check('commercial: canjes del período = suma de benefitsRedeemed', com.data.benefitsRedeemed === win30.reduce((s2, d) => s2 + d.benefitsRedeemed, 0));
  check('commercial: sin rol finance → 403', (await call('GET', '/metrics/commercial', { token: support })).status === 403);
  check('range inválido cae a 30d', (await call('GET', '/metrics/overview?range=xx', { token: ops })).meta.range === '30d');

  section('Auditoría');
  const audit = await call('GET', '/audit-log', { token: admin });
  const auditTxt = JSON.stringify(audit.data);
  check('auditLog registra las acciones de esta prueba', audit.status === 200 && auditTxt.includes('sponsors/'));
  check('auditLog registra el cambio de ticket (campos undefined descartados)', auditTxt.includes('tickets/'));
  check('auditLog registra la resolución de recorrección', auditTxt.includes('corrections/'));

  section('Seed idempotente (contador de tickets)');
  const counter = (await db.collection('counters').doc('ticketNumber').get()).data();
  check('counters/ticketNumber ≥ máximo número de ticket', counter.value >= Math.max(...list.data.map((t) => t.number)));
} catch (e) {
  fails.push(`EXCEPCIÓN: ${e.message}`);
  console.error(e);
}

server.close();
console.log(`\nResultado: ${pass} OK, ${fails.length} fallas`);
if (fails.length) { console.log('Fallas:\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
