@echo off
chcp 65001 >nul
cd /d "%~dp0"
cd /d "%~dp0.."
echo ============================================================
echo  GIT: commit del modelo canonico de Max (#7, #8, #5, #4, #2)
echo ============================================================
echo.
git rev-parse --show-toplevel || (echo No es un repositorio git. & pause & exit /b)
echo.
echo Rama actual:
git branch --show-current
echo.
echo --- Archivos sensibles: deben aparecer como IGNORADOS ---
git check-ignore -v backend/serviceAccount.json backend/.env
echo.
echo --- Cambios a incluir ---
git add -A
git status --short
echo.
echo Revisa la lista: NO debe aparecer serviceAccount.json ni .env
choice /c SN /m "Hacer el commit con estos archivos"
if errorlevel 2 (
  git reset
  echo Cancelado. No se hizo nada.
  pause
  exit /b
)

> "%TEMP%\msg_commit.txt" echo Modelo canonico de Max: usuarios admin, planes, operativa, medalLedger y metricas
>> "%TEMP%\msg_commit.txt" echo.
>> "%TEMP%\msg_commit.txt" echo - #7 adminUsers: emailLower, active, bloqueo por intentos fallidos, lastLoginAt
>> "%TEMP%\msg_commit.txt" echo - #8 plans/features: name {es,en}, price {monthly,yearly}, concurrencia por updatedAt
>> "%TEMP%\msg_commit.txt" echo - #5 operativa: serviceStatus, opsConfig, opsRestarts; servicio sano tras reiniciar
>> "%TEMP%\msg_commit.txt" echo - #4 medalLedger: recompensa de recorreccion en una sola transaccion
>> "%TEMP%\msg_commit.txt" echo - #2 metricsDaily/metricsMonthly sinteticos; Resumen y Comercial se componen desde ellos
>> "%TEMP%\msg_commit.txt" echo - Seguridad de pruebas: envGuard, emulador, seed:emu y smoke (110 pruebas)
>> "%TEMP%\msg_commit.txt" echo - Scripts de migracion/backfill con --dry-run para la base real

git commit -F "%TEMP%\msg_commit.txt"
echo.
git log --oneline -3
echo.
choice /c SN /m "Subir (git push) a GitHub ahora"
if errorlevel 2 (
  echo No se subio. Cuando quieras: git push
  pause
  exit /b
)
git push
echo.
pause
