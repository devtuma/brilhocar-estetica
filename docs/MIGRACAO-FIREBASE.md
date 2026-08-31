# 🚀 Guia Rápido: Migrar Projeto Firebase para Novo

Este guia mostra como transferir TODA a configuração do BrilhoCar para um novo projeto Firebase em minutos.

---

## 📋 Pré-requisitos

1. Projeto Firebase **antigo** configurado (onde está funcionando)
2. Projeto Firebase **novo** criado (vazio)
3. Google Cloud CLI (`gcloud`) instalado
4. Firebase CLI instalado (`npm install -g firebase-tools`)

---

## 🔑 Informações que você precisa

Primeiro, anote estas informações dos dois projetos:

### Projeto ANTIGO (atual)
- **Project ID**: `brilhocar-estetica-9f14b` (ou o ID que você usa)
- **Bucket**: `brilhocar-estetica-9f14b.appspot.com` ou `brilhocar-estetica-9f14b-storage`

### Projeto NOVO (vazio)
- **Project ID**: `estetica-NOVOCLIENTE` (você define)
- Você vai criar o bucket durante o processo

---

## ⚡ PASSO 1: Exportar Tudo do Projeto Antigo

### 1.1 Exporte usuários da autenticação
```bash
firebase auth:export auth-export.json --format=json --project brilhocar-estetica-9f14b
```

### 1.2 Exporte regras de segurança
```bash
# Firestore
firebase firestore:rules:get --project brilhocar-estetica-9f14b > firestore.rules

# Storage  
firebase storage:rules:get --project brilhocar-estetica-9f14b > storage.rules
```

### 1.3 Exporte configurações de Functions
```bash
# Liste todas as funções
firebase functions:list --project brilhocar-estetica-9f14b
```

### 1.4 Copie arquivos do Storage
```bash
# Substitua os nomes dos buckets!
gcloud storage cp -r gs://brilhocar-estetica-9f14b-storage/* gs://SEU-NOVO-BUCKET.appspot.com/
```

---

## ⚡ PASSO 2: Configurar o Projeto Novo

### 2.1 Ative os serviços no Console do Firebase

Acesse https://console.firebase.google.com → Selecione o projeto novo:

1. **Authentication** → "Começar" → Habilite "Email/Senha"
2. **Firestore** → "Criar banco de dados" → Escolha região `southamerica-east1`
3. **Storage** → "Começar" → Aceitar padrões
4. **Functions** → "Começar" → Plano Blaze (necessário para Functions)

### 2.2 Vincule o projeto ao Firebase CLI
```bash
cd "BrilhoCar Estetica Automotiva"

# Adicione o novo projeto
firebase use --add

# Selecione o novo projeto como ativo
firebase use SEU-NOVO-PROJECT-ID
```

### 2.3 Configure variáveis de ambiente
```bash
# Edite o .env.local do novo projeto
# Atualize:
VITE_FIREBASE_API_KEY=AIzaSy...          # Do projeto novo
VITE_FIREBASE_AUTH_DOMAIN=SEU-NOVO-PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=SEU-NOVO-PROJECT-ID
VITE_FIREBASE_STORAGE_BUCKET=SEU-NOVO-BUCKET.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:xxxx
```

---

## ⚡ PASSO 3: Importar para o Projeto Novo

### 3.1 Importe usuários
```bash
firebase auth:import auth-export.json --project SEU-NOVO-PROJECT-ID
```

### 3.2 Deploy regras de segurança
```bash
firebase deploy --only firestore:rules --project SEU-NOVO-PROJECT-ID
firebase deploy --only storage:rules --project SEU-NOVO-PROJECT-ID
```

### 3.3 Deploy Functions (Cloud Functions)
```bash
cd functions
npm run deploy -- --project SEU-NOVO-PROJECT-ID
```

### 3.4 Deploy Hosting
```bash
npm run build
cd ..
firebase deploy --only hosting --project SEU-NOVO-PROJECT-ID
```

---

## ⚡ PASSO 4: Migrar Dados do Firestore

### Opção A: Via Firebase Console (mais fácil)
1. No projeto **antigo**: Firestore → ⋮ → "Exportar dados" (Exportar para JSON)
2. No projeto **novo**: Firestore → "Importar dados" → Selecione o arquivo

### Opção B: Via Cloud Shell (para grandes volumes)
```bash
# No Cloud Shell do projeto antigo:
gcloud firestore export gs://bucket-antigo/firestore-backup --project brilhocar-estetica-9f14b

# No projeto novo:
gcloud firestore import gs://bucket-antigo/firestore-backup --project SEU-NOVO-PROJECT-ID
```

---

## ⚡ PASSO 5: Configurar Asaas (PIX)

### 5.1 Obtenha a API Key do Asaas
Se você tem a API Key do Asaas antiga:
```bash
# Cole no .env.local do projeto novo
ASAAS_API_KEY=sua_chave_aqui
```

### 5.2 Configure o webhook no Asaas
1. Acesse https://www.asaas.com → Configurações → Webhooks
2. Adicione URL:
   ```
   https://us-central1-SEU-NOVO-PROJECT.cloudfunctions.net/asaasWebhook
   ```
3. Selecione eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`

---

## 📋 Checklist de Verificação

Depois de fazer tudo, marque aqui:

- [ ] Autenticação funcionando (login/admin)
- [ ] Firestore respondendo
- [ ] Storage lendo/gravando imagens
- [ ] Cloud Functions deployadas
- [ ] PIX criando cobranças
- [ ] Webhook do Asaas configurado
- [ ] Dados migrados (agendamentos, usuários)

---

## 🔧 Scripts de Automação

Crie um arquivo `migrate-project.sh` para facilitar:

```bash
#!/bin/bash

# ============================================
# MIGRATION SCRIPT - BrilhoCar Firebase
# ============================================

# CONFIGURAÇÕES - EDITE AQUI
OLD_PROJECT="brilhocar-estetica-9f14b"
NEW_PROJECT="estetica-NOVOCLIENTE"
OLD_BUCKET="brilhocar-estetica-9f14b-storage"
NEW_BUCKET="estetica-novocliente.appspot.com"

echo "🚀 Iniciando migração..."
echo "De: $OLD_PROJECT"
echo "Para: $NEW_PROJECT"

# 1. Exportar
echo "📤 Exportando usuários..."
firebase auth:export auth-export.json --format=json --project $OLD_PROJECT

echo "📋 Exportando regras..."
firebase firestore:rules:get --project $OLD_PROJECT > firestore.rules
firebase storage:rules:get --project $OLD_PROJECT > storage.rules

echo "📁 Copiando arquivos do Storage..."
gcloud storage cp -r gs://$OLD_BUCKET/* gs://$NEW_BUCKET/

# 2. Importar
echo "📥 Importando usuários..."
firebase auth:import auth-export.json --project $NEW_PROJECT

echo "📥 Deployando regras..."
firebase deploy --only firestore:rules,storage:rules --project $NEW_PROJECT

echo "📥 Deployando Functions..."
cd functions && firebase deploy --only functions --project $NEW_PROJECT && cd ..

echo "✅ Migração básica concluída!"
echo "Agora configure:"
echo "1. .env.local com as novas credenciais"
echo "2. Asaas webhook no painel do Asaas"
echo "3. Build e deploy do frontend"
```

---

## ⚠️ O que NÃO é copiado automaticamente

Você precisará configurar manualmente:

| Item | Como fazer |
|------|------------|
| API Key do Asaas | Copiar do .env.local antigo |
| Configurações de billing | Configurar cartão no Console |
| Domínios customizados | Configurar DNS novamente |
| Apps Android/iOS | Registrar novamente no Firebase |
| Limites de rate | Configurar no Console |
| OAuth (Google/Facebook login) | Configurar novamente |

---

## 🆘 Se Der Problema

### "Permission denied" no Storage
```bash
# Adicione permissão ao bucket novo
gcloud storage buckets add-iam-policy-binding gs://$NEW_BUCKET \
  --member="serviceAccount:firebase-adminsdk-xxxx@$NEW_PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### Functions não deployam
```bash
# Verifique se tem plano Blaze
firebase plans --project $NEW_PROJECT

# Faça upgrade se necessário
```

### "Bucket does not exist"
```bash
# Crie o bucket
gcloud storage buckets create gs://$NEW_BUCKET \
  --project=$NEW_PROJECT \
  --location=southamerica-east1
```

---

## 📞 Precisa de Ajuda?

Se tiver dúvidas, me chame com:
- O nome do projeto novo
- Onde parou (em qual passo)
- A mensagem de erro (se houver)
