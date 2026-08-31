# ============================================
# MIGRATION SCRIPT - BrilhoCar Firebase
# Execute no PowerShell no Windows
# ============================================

# ============================================
# CONFIGURAÇÕES - EDITE ESTAS VARIÁVEIS
# ============================================
$OLD_PROJECT = "brilhocar-estetica-9f14b"
$NEW_PROJECT = "estetica-NOVOCLIENTE"
$OLD_BUCKET = "brilhocar-estetica-9f14b-storage"
$NEW_BUCKET = "estetica-novocliente.appspot.com"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 MIGRATION SCRIPT - BrilhoCar Firebase" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "De: $OLD_PROJECT"
Write-Host "Para: $NEW_PROJECT"
Write-Host "Bucket Antigo: $OLD_BUCKET"
Write-Host "Bucket Novo: $NEW_BUCKET"
Write-Host ""

$confirm = Read-Host "Continuar? (s/n)"
if ($confirm -ne "s" -and $confirm -ne "S") {
    exit 1
}

# ============================================
# PASSO 1: Exportar do projeto antigo
# ============================================
Write-Host ""
Write-Host "📤 PASSO 1: Exportando dados do projeto antigo..." -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow

Write-Host "📋 Exportando regras de segurança..."
firebase firestore:rules:get --project $OLD_PROJECT > firestore.rules
firebase storage:rules:get --project $OLD_PROJECT > storage.rules
Write-Host "   ✅ Regras salvas em firestore.rules e storage.rules" -ForegroundColor Green

Write-Host "📁 Copiando arquivos do Storage..."
Write-Host "   De: gs://$OLD_BUCKET"
Write-Host "   Para: gs://$NEW_BUCKET"
gcloud storage cp -r "gs://$OLD_BUCKET/*" "gs://$NEW_BUCKET/" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Arquivos copiados" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Bucket vazio ou não encontrado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📤 Exportando usuários..."
try {
    firebase auth:export auth-export.json --format=json --project $OLD_PROJECT
    Write-Host "   ✅ Usuários exportados para auth-export.json" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Nenhum usuário para exportar" -ForegroundColor Yellow
}

# ============================================
# PASSO 2: Listar o que foi exportado
# ============================================
Write-Host ""
Write-Host "📋 PASSO 2: Resumo da exportação" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow

if (Test-Path "firestore.rules") {
    Write-Host "   ✅ firestore.rules" -ForegroundColor Green
}
if (Test-Path "storage.rules") {
    Write-Host "   ✅ storage.rules" -ForegroundColor Green
}
if (Test-Path "auth-export.json") {
    Write-Host "   ✅ auth-export.json" -ForegroundColor Green
}

# ============================================
# PASSO 3: Instruções
# ============================================
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "📥 PASSO 3: Configurar o projeto NOVO" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Execute estes comandos no terminal:" -ForegroundColor White
Write-Host ""
Write-Host "1️⃣  Vincule o projeto ao Firebase CLI:" -ForegroundColor Yellow
Write-Host '    cd "BrilhoCar Estetica Automotiva"'
Write-Host "    firebase use --add"
Write-Host "    (selecione: $NEW_PROJECT)"
Write-Host ""
Write-Host "2️⃣  Importe os usuários:" -ForegroundColor Yellow
Write-Host "    firebase auth:import auth-export.json --project $NEW_PROJECT"
Write-Host ""
Write-Host "3️⃣  Deploy as regras:" -ForegroundColor Yellow
Write-Host "    firebase deploy --only firestore:rules,storage:rules --project $NEW_PROJECT"
Write-Host ""
Write-Host "4️⃣  Deploy as Functions:" -ForegroundColor Yellow
Write-Host "    cd functions"
Write-Host "    firebase deploy --only functions --project $NEW_PROJECT"
Write-Host "    cd .."
Write-Host ""
Write-Host "5️⃣  Deploy o frontend:" -ForegroundColor Yellow
Write-Host "    npm run build"
Write-Host "    firebase deploy --only hosting --project $NEW_PROJECT"
Write-Host ""

Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Script concluído!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
