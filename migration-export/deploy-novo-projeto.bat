@echo off
REM ============================================
REM DEPLOY SCRIPT - Novo Projeto Firebase
REM ============================================

SET NEW_PROJECT=SEU-NOVO-PROJECT-ID

echo 🚀 Deploying para %NEW_PROJECT%...

echo.
echo 📋 Deploying Firestore rules...
firebase deploy --only firestore:rules --project %NEW_PROJECT%

echo.
echo 📋 Deploying Storage rules...
firebase deploy --only storage:rules --project %NEW_PROJECT%

echo.
echo 📋 Deploying Functions...
cd functions
firebase deploy --only functions --project %NEW_PROJECT%
cd ..

echo.
echo 📋 Deploying Hosting...
npm run build
firebase deploy --only hosting --project %NEW_PROJECT%

echo.
echo ✅ Deploy completo!
pause
