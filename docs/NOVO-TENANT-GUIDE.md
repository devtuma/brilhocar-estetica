# 📋 Guia: Como Configurar um Novo Cliente (Tenant) no BrilhoCar

Este guia mostra passo-a-passo como configurar um novo cliente no sistema white-label.

---

## 🎯 Visão Geral da Arquitetura

Cada cliente (tenant) pode ter:
- **Nome personalizado** e branding (logo, cores, textos)
- **Chave PIX Asaas própria** para receber pagamentos
- **Firebase próprio** (opcional - recomendado para isolamento completo)
- **Dados completamente separados** dos outros clientes

---

## 📝 Opções de Configuração

### Opção A: Novo Firebase Project (Recomendado) ⭐

Isolamento completo - cada cliente tem seu próprio projeto Firebase.

#### Passo 1: Criar novo Firebase Project
1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Clique em **"Adicionar projeto"**
3. Nomeie: `estetica-[nome-do-cliente]` (ex: `estetica-jardim`)
4. Desabilite Google Analytics (opcional)
5. Clique em **Criar projeto**

#### Passo 2: Ativar serviços
1. **Authentication**:
   - Vá em Authentication → Começar
   - Habilite "Email/Senha"
   - Configure provedores desejados

2. **Firestore**:
   - Vá em Firestore Database → Criar banco de dados
   - Escolha região mais próxima (ex: `southamerica-east1`)
   - Inicie em modo teste

3. **Storage**:
   - Vá em Storage → Começar
   - Inicie em modo teste
   - Depois configure regras de segurança

4. **Functions** (opcional para PIX):
   - Vá em Functions → Começar
   - Plano Blaze (pay-as-you-go) necessário
   - Deploy as Cloud Functions do projeto

#### Passo 3: Obter credenciais
No Firebase Console, vá em **Configurações do Projeto** → **Seus apps** → **Web** (</>):
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "estetica-jardim.firebaseapp.com",
  projectId: "estetica-jardim",
  storageBucket: "estetica-jardim.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

#### Passo 4: Criar admin inicial
```bash
cd "BrilhoCar Estetica Automotiva"

# Use o script de criação de admin
node scripts/create-admin.cjs admin@novocliente.com SenhaForte123 novo-cliente-id
```

#### Passo 5: Registrar tenant no sistema principal
No Firestore do BrilhoCar original, criar documento em `tenants/[novo-id]`:
```json
{
  "id": "novo-cliente-id",
  "displayName": "Estética Jardim",
  "primaryColor": "#FF6B35",
  "asaasApiKey": "criptografada",
  "asaasEnvironment": "sandbox",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### Passo 6: Configurar domínio (Vercel)
```bash
# No painel Vercel do projeto
# Adicionar novo domínio: estetica-jardim.vercel.app

# Ou domínio customizado:
# Dominio: esteticajardim.com.br
# Configure DNS:
#   CNAME → cname.vercel-dns.com
```

---

### Opção B: Mesmo Firebase (Mais simples)

Compartilha o mesmo Firebase, separa por collections/dados.

#### Passo 1: Configurar novo tenant no Admin
1. Acesse `/admin/branding`
2. Configure nome e cores
3. Salve

#### Passo 2: Criar usuário admin
```bash
node scripts/create-admin.cjs admin@novocliente.com SenhaForte123 tenant-id
```

#### Passo 3: Definir tenant no código
No `.env.local` ou configuração de build:
```bash
VITE_TENANT_ID=tenant-id
```

---

## 🔧 Configuração do Asaas (PIX)

### Criar conta Asaas
1. Acesse [Asaas](https://www.asaas.com)
2. Crie conta empresarial
3. Obtenha API Key em **Configurações → Integrações → API Key**

### Configurar webhook
Em Asaas → Configurações → Webhooks:
```
URL: https://us-central1-seu-projeto.cloudfunctions.net/asaasWebhook
Eventos: PAYMENT_RECEIVED, PAYMENT_CONFIRMED
```

### Configurar no sistema
No Admin → Configurações PIX:
1. Cole a API Key
2. Selecione ambiente (Sandbox/Produção)
3. Configure vencimento do PIX
4. Salve

---

## 🎨 Configuração de Branding

### Via Admin Panel
Acesse `/admin/branding`:

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| Nome do negócio | Nome fantasia | "Estética Jardim" |
| Cor primária | Cor principal (hex) | `#FF6B35` |
| Cor de destaque | Cor secundária | `#D4AF37` |
| Telefone | Contato | `(11) 99999-9999` |
| WhatsApp | Link direto | `5511999999999` |
| Instagram | @ do Instagram | `@esteticajardim` |
| Endereço | Localização | "Rua X, 123 - SP" |

### Preview
- Alterações aparecem em **tempo real** no preview
- Salvar aplica para todos os usuários

---

## 📱 Configuração Mobile

### Android (PWA)
O site já é PWA. Para adicionar à tela inicial:
1. Usuário acessa pelo Chrome
2. Menu → "Adicionar à tela inicial"

### iOS (PWA)
1. Acesse pelo Safari
2. Compartilhar → "Na tela inicial"

---

## 🔐 Segurança

### Storage Rules (Firestore)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Agendamentos: cliente vê só os seus
    match /appointments/{appointmentId} {
      allow read: if request.auth != null 
        && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    // Galeria: público para leitura
    match /gallery/{imageId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Tenants: só admins
    match /tenants/{tenantId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == 'admin-uid';
    }
  }
}
```

### Storage Rules (Firebase Storage)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /gallery/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 🚀 Deploy

### Frontend (Vercel)
```bash
# Conectar repo ao Vercel
# Deploy automático a cada push no main

# Variáveis de ambiente no Vercel:
VITE_TENANT_ID=tenant-id
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Backend (Firebase Functions)
```bash
cd functions
firebase deploy --only functions
```

---

## ✅ Checklist de Configuração

- [ ] Firebase Project criado
- [ ] Authentication ativado
- [ ] Firestore criado
- [ ] Storage criado
- [ ] Cloud Functions deployadas
- [ ] Admin criado com script
- [ ] Tenant registrado
- [ ] Branding configurado
- [ ] PIX/Asaas configurado
- [ ] Webhook do Asaas apontando para Cloud Function
- [ ] Teste de login funcionando
- [ ] Teste de upload de imagem funcionando
- [ ] Teste de agendamento funcionando
- [ ] Teste de PIX funcionando

---

## 🆘 Troubleshooting

### "Bucket does not exist"
```bash
# Criar bucket no Google Cloud Console
gcloud storage buckets create gs://nome-do-bucket --project=projeto-id
```

### "Permission denied" no Storage
```bash
# Adicionar permissão para Firebase service account
gcloud storage buckets add-iam-policy-binding gs://bucket-name \
  --member="serviceAccount:firebase-adminsdk-xxxx@project.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### API Key bloqueada
```bash
# Atualizar restrições da API Key
gcloud services api-keys update projects/PROJECT/keys/KEY_ID \
  --allowed-referrers="https://seudominio.com/*"
```

---

## 📞 Suporte

Para dúvidas:
-Vicente: devtuma@gmail.com
