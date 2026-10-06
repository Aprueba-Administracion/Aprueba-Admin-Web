// Protección contra escrituras accidentales sobre el Firestore REAL.
// Los scripts de mantenimiento (seed, clear:audit, etc.) llaman a
// assertSafeTarget() antes de tocar la base. Por defecto SOLO corren contra
// el emulador (FIRESTORE_EMULATOR_HOST definido). Para apuntar a Firestore
// real hay que pasar --real de forma explícita, y se imprime el proyecto.
// Motivo: el plan gratuito de Firebase tiene cuota diaria de lecturas/escrituras;
// un seed (que lee y borra colecciones) corrido por error sobre la base real
// puede agotarla y dejar la consola caída hasta el día siguiente.
export function assertSafeTarget(label) {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  const real = process.argv.includes('--real');
  if (emulator) {
    console.log(`[${label}] Destino: EMULADOR (${emulator}) — sin costo de cuota.`);
    return;
  }
  if (!real) {
    console.error(
      `\n[${label}] BLOQUEADO: no hay FIRESTORE_EMULATOR_HOST y no pasaste --real.\n` +
      `  • Para probar sin gastar cuota: corre "npm run emulator" en otra terminal y\n` +
      `    define FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (o usa "npm run seed:emu").\n` +
      `  • Para tocar el Firestore REAL a propósito: agrega --real al comando.\n`
    );
    process.exit(1);
  }
  const project = process.env.GCLOUD_PROJECT || '(sin GCLOUD_PROJECT)';
  console.warn(`[${label}] ATENCIÓN: escribiendo en Firestore REAL, proyecto "${project}". Gastará cuota.`);
}
