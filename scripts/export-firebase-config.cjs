/**
 * Script de Migração - Exportar Configurações do Firebase
 *
 * Uso: node scripts/export-firebase-config.cjs
 *
 * Este script exporta:
 * - Regras do Firestore
 * - Regras do Storage
 * - Lista de Functions
 * - Configurações do projeto
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURAÇÕES
// ============================================
const OLD_PROJECT = 'brilhocar-estetica-9f14b'; // NÃO MUDE - é o projeto atual
const OUTPUT_DIR = path.join(__dirname, '..', 'migration-export');

// ============================================
// FUNÇÕES
// ============================================

function run(command, description) {
  console.log(`\n📋 ${description}...`);
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    return output;
  } catch (error) {
    console.log(`   ⚠️  Erro: ${error.message}`);
    return null;
  }
}

function saveFile(content, filename) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, content, 'utf-8');
  console.log(`   ✅ Salvo: ${filepath}`);
}

// ============================================
// MAIN
// ============================================

console.log('==========================================');
console.log('🚀 EXPORTANDO CONFIGURAÇÕES DO FIREBASE');
console.log('==========================================');
console.log(`\nProjeto: ${OLD_PROJECT}`);
console.log(`Output:  ${OUTPUT_DIR}`);

// Criar diretório de output
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Exportar Regras do Firestore
console.log('\n\n📁 PASSO 1: Regras do Firestore');
console.log('------------------------------------------');
let firestoreRules = run(
  `firebase firestore:rules:get --project ${OLD_PROJECT}`,
  'Exportando regras do Firestore'
);
if (firestoreRules) {
  saveFile(firestoreRules, 'firestore.rules');
}

// 2. Exportar Regras do Storage
console.log('\n\n📁 PASSO 2: Regras do Storage');
console.log('------------------------------------------');
let storageRules = run(
  `firebase storage:rules:get --project ${OLD_PROJECT}`,
  'Exportando regras do Storage'
);
if (storageRules) {
  saveFile(storageRules, 'storage.rules');
}

// 3. Listar Functions
console.log('\n\n📁 PASSO 3: Cloud Functions');
console.log('------------------------------------------');
let functionsList = run(
  `firebase functions:list --project ${OLD_PROJECT}`,
  'Listando Functions'
);
if (functionsList) {
  saveFile(functionsList, 'functions-list.txt');
}

// 4. Listar indexes do Firestore
console.log('\n\n📁 PASSO 4: Indexes do Firestore');
console.log('------------------------------------------');
let indexesList = run(
  `firebase firestore:indexes:get --project ${OLD_PROJECT}`,
  'Exportando indexes'
);
if (indexesList) {
  saveFile(indexesList, 'firestore.indexes.json');
}

// 5. Info do projeto
console.log('\n\n📁 PASSO 5: Informações do Projeto');
console.log('------------------------------------------');
const projectInfo = `
# Informações do Projeto Firebase

Projeto ID: ${OLD_PROJECT}

## Como usar estas configurações:

1. Crie um novo projeto Firebase
2. Ative os mesmos serviços (Firestore, Storage, Functions, Auth)
3. Copie os arquivos .rules para o novo projeto
4. Deploy as regras: firebase deploy --only firestore:rules,storage:rules

## Para migrar usuários:

firebase auth:export auth-export.json --format=json --project ${OLD_PROJECT}
firebase auth:import auth-export.json --project NOVO-PROJECT-ID

## Para copiar arquivos do Storage:

gcloud storage cp -r gs://bucket-antigo/* gs://bucket-novo/

## Arquivos exportados:
- firestore.rules    → Regras de segurança do Firestore
- storage.rules      → Regras de segurança do Storage
- functions-list.txt → Lista das Cloud Functions
- firestore.indexes.json → Índices do Firestore
`;
saveFile(projectInfo, 'README-MIGRATION.txt');

// 6. Criar script de deploy para o novo projeto
console.log('\n\n📁 PASSO 6: Criando scripts de deploy');
console.log('------------------------------------------');

const deployScript = `@echo off
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
`;

saveFile(deployScript, 'deploy-novo-projeto.bat');

// ============================================
// RESUMO
// ============================================

console.log('\n\n==========================================');
console.log('✅ EXPORTAÇÃO CONCLUÍDA!');
console.log('==========================================');
console.log(`\nArquivos salvos em: ${OUTPUT_DIR}`);
console.log('\nArquivos exportados:');
console.log('  ✅ firestore.rules');
console.log('  ✅ storage.rules');
console.log('  ✅ functions-list.txt');
console.log('  ✅ firestore.indexes.json');
console.log('  ✅ README-MIGRATION.txt');
console.log('  ✅ deploy-novo-projeto.bat');
console.log('\n📋 Próximos passos:');
console.log('1. Copie a pasta "migration-export" para o computador do cliente');
console.log('2. No projeto NOVO, ative Firestore, Storage, Functions, Auth');
console.log('3. Execute deploy-novo-projeto.bat (editando o PROJECT-ID primeiro)');
