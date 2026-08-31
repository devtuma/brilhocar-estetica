#!/bin/bash
# ============================================
# MIGRATION SCRIPT - BrilhoCar Firebase
# Execute no Git Bash ou terminal Linux/Mac
# ============================================

# ============================================
# CONFIGURAÇÕES - EDITE ESTAS VARIÁVEIS
# ============================================
OLD_PROJECT="brilhocar-estetica-9f14b"
NEW_PROJECT="estetica-NOVOCLIENTE"
OLD_BUCKET="brilhocar-estetica-9f14b-storage"
NEW_BUCKET="estetica-novocliente.appspot.com"

echo "=========================================="
echo "🚀 MIGRATION SCRIPT - BrilhoCar Firebase"
echo "=========================================="
echo ""
echo "De: $OLD_PROJECT"
echo "Para: $NEW_PROJECT"
echo "Bucket Antigo: $OLD_BUCKET"
echo "Bucket Novo: $NEW_BUCKET"
echo ""

read -p "Continuar? (s/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    exit 1
fi

# ============================================
# PASSO 1: Exportar do projeto antigo
# ============================================
echo ""
echo "📤 PASSO 1: Exportando dados do projeto antigo..."
echo "=========================================="

echo "📋 Exportando regras de segurança..."
firebase firestore:rules:get --project $OLD_PROJECT > firestore.rules
firebase storage:rules:get --project $OLD_PROJECT > storage.rules
echo "   ✅ Regras salvas em firestore.rules e storage.rules"

echo "📁 Copiando arquivos do Storage (isso pode demorar)..."
echo "   De: gs://$OLD_BUCKET"
echo "   Para: gs://$NEW_BUCKET"
gcloud storage cp -r gs://$OLD_BUCKET/* gs://$NEW_BUCKET/ 2>/dev/null || echo "   ⚠️  Bucket vazio ou não encontrado, continuando..."

echo ""
echo "📤 Exportando usuários (se existirem)..."
if firebase auth:export auth-export.json --format=json --project $OLD_PROJECT 2>/dev/null; then
    echo "   ✅ Usuários exportados para auth-export.json"
else
    echo "   ⚠️  Nenhum usuário para exportar ou erro (ignorando)"
fi

# ============================================
# PASSO 2: Listar o que foi exportado
# ============================================
echo ""
echo "📋 PASSO 2: Resumo da exportação"
echo "=========================================="
echo "Arquivos criados:"
ls -la firestore.rules 2>/dev/null && echo "   ✅ firestore.rules"
ls -la storage.rules 2>/dev/null && echo "   ✅ storage.rules"
ls -la auth-export.json 2>/dev/null && echo "   ✅ auth-export.json"
ls -la firestore.rules 2>/dev/null && wc -l firestore.rules

# ============================================
# PASSO 3: Instruções para configuração do novo
# ============================================
echo ""
echo "=========================================="
echo "📥 PASSO 3: Configurar o projeto NOVO"
echo "=========================================="

echo ""
echo "Execute estes comandos no terminal:"
echo ""
echo "1️⃣  Vincule o projeto ao Firebase CLI:"
echo "    cd \"BrilhoCar Estetica Automotiva\""
echo "    firebase use --add"
echo "    (selecione: $NEW_PROJECT)"
echo ""
echo "2️⃣  Importe os usuários:"
echo "    firebase auth:import auth-export.json --project $NEW_PROJECT"
echo ""
echo "3️⃣  Deploy as regras:"
echo "    firebase deploy --only firestore:rules,storage:rules --project $NEW_PROJECT"
echo ""
echo "4️⃣  Deploy as Functions:"
echo "    cd functions"
echo "    firebase deploy --only functions --project $NEW_PROJECT"
echo "    cd .."
echo ""
echo "5️⃣  Deploy o frontend:"
echo "    npm run build"
echo "    firebase deploy --only hosting --project $NEW_PROJECT"
echo ""

echo "=========================================="
echo "✅ Script concluído!"
echo "=========================================="
