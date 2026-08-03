# Firebase Setup — BrilhoCar Estética Automotiva

> **Status do Projeto:** Em configuração
> **Plano Atual:** Blaze (pay-as-you-go) — apenas paga se exceder limites gratuitos
> **Última atualização:** Junho 2026

---

## ✅ Credenciais do Projeto (Já Configuradas)

As credenciais já foram copiadas para [js/firebase-config.js](js/firebase-config.js):

```javascript
var FIREBASE_CONFIG = window.FIREBASE_CONFIG = {
    apiKey:            'AIzaSyO8FaR87F73AkRLMFXJxFVJg4XFQJKVPQM',
    authDomain:        'brilhocar-estetica.firebaseapp.com',
    projectId:         'brilhocar-estetica',
    storageBucket:     'brilhocar-estetica.firebasestorage.app',
    messagingSenderId: '542562856492',
    appId:             '1:542562856492:web:cafb728b8bb1d086c2eb89',
    ADMIN_EMAIL:       'admin@brilhocar.com',
    ADMIN_PASS:        'BrilhoCar2025!',
};
```

---

## 📋 Próximos Passos no Console Firebase

### ✅ Concluído
- [x] Criar projeto Firebase `brilhocar-estetica`
- [x] Upgrade para plano Blaze
- [x] Configurar Firebase no app Web (código copiado)

### 🔄 Em Andamento
- [ ] **Storage**: Configurar bucket (local: `US-EAST1`)

### ⏳ Pendente
- [ ] **Authentication**: Habilitar Email/Password
- [ ] **Authentication**: Criar usuário admin
- [ ] **Firestore Database**: Criar banco (local: `southamerica-east1`)
- [ ] **Firestore**: Colar regras de segurança
- [ ] **Firestore**: Criar collection `settings/business` com seed
- [ ] **Firestore**: Criar collection `services` com seed
- [ ] **Firestore**: Criar collection `testimonials` com seed

---

## 🔒 Regras de Segurança — Firestore

Cole em **Firestore Database → Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // === SETTINGS (Configurações do negócio) ===
    match /settings/{doc} {
      allow read: if true;  // Público para o site ler configurações
      allow write: if request.auth != null;  // Apenas admin autenticado
    }

    // === SERVICES (Catálogo de serviços) ===
    match /services/{serviceId} {
      allow read: if true;  // Público para clientes verem serviços
      allow write: if request.auth != null;  // Apenas admin
    }

    // === CLIENTS (Clientes) ===
    match /clients/{clientId} {
      allow read: if request.auth != null;  // Apenas admin
      allow create: if true;  // Clientes podem se cadastrar
      allow update, delete: if request.auth != null;  // Apenas admin
    }

    // === APPOINTMENTS (Agendamentos) ===
    match /appointments/{appointmentId} {
      allow read: if true;  // Público para acompanhamento por código
      allow create: if true;  // Clientes podem criar agendamentos
      allow update: if request.auth != null;  // Apenas admin/operador
      allow delete: if request.auth != null;  // Apenas admin
    }

    // === TRANSACTIONS (Financeiro) ===
    match /transactions/{transactionId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // === TESTIMONIALS (Depoimentos) ===
    match /testimonials/{testimonialId} {
      allow read: if true;  // Público para ver depoimentos no site
      allow write: if request.auth != null;  // Apenas admin
    }

    // === IMAGES (URLs de imagens) ===
    match /images/{imageId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // === AUDIT_LOGS (Histórico de alterações) ===
    match /audit_logs/{logId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false;  // Nunca apagar histórico
    }

    // === USER DATA (Usuários do Firebase Auth) ===
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

---

## 🔒 Regras de Segurança — Storage

Cole em **Storage → Rules**:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucketName}/o {

    // Imagens públicas (galeria, antes/depois)
    match /images/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Avatares de clientes
    match /avatars/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Fotos de veículos (antes/depois)
    match /vehicles/{appointmentId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Qualquer outro path bloqueado por padrão
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 👤 Configurar Authentication

### Habilitar Método
1. **Authentication** → **Sign-in method**
2. Clique em **Email/Password**
3. Ative a primeira opção (Email/Password)
4. Clique em **Salvar**

### Criar Usuário Admin
1. **Authentication** → **Users** → **Add user**
2. Preencha:
   - **Email**: `admin@brilhocar.com`
   - **Senha**: `BrilhoCar2025!` (ou outra forte)
3. Clique em **Add user**

---

## 🗄️ Criar Firestore Database

1. **Firestore Database** → **Criar banco de dados**
2. **Local**: `southamerica-east1 (São Paulo)` — IMPORTANTE para LGPD
3. **Modo**: Começar no modo de teste (ajustaremos depois)
4. Clique em **Criar**

---

## 📦 Seed Data — Criar no Console

### 1. Collection: `settings`
**Documento ID:** `business`

```json
{
  "businessName": "BrilhoCar Estética Automotiva",
  "tagline": "BrilhoCar Estética Automotiva • Mauá",
  "whatsapp": "5511999999999",
  "instagram": "leandrinho.detail",
  "address": "Rua Aramis Forte, 340 — Mauá/SP",
  "horario": "Seg–Sáb: 8h às 18h",
  "logoUrl": "",
  "heroImage": "",
  "aboutImage": "",
  "galleryImages": [],
  "stats": [
    { "value": 500, "suffix": "+", "label": "Carros Atendidos" },
    { "value": 5, "suffix": "+", "label": "Anos de Experiência" },
    { "value": 4.9, "suffix": "★", "label": "Avaliação no Google", "isDecimal": true },
    { "value": 100, "suffix": "%", "label": "Satisfação Garantida" }
  ],
  "workingDays": [1, 2, 3, 4, 5, 6],
  "workingHours": { "start": "08:00", "end": "18:00" },
  "slotDuration": 60,
  "breakTime": 15,
  "maxPerDay": 8,
  "blockedDates": [],
  "activeTheme": "default"
}
```

### 2. Collection: `services`

Crie 6 documentos com **IDs automáticos**:

```json
[
  { "nome": "Lavagem Completa", "preco": 80, "duracao": "1-2h", "descricao": "Lavagem externa e interna com aspiração, limpeza de vidros, rodas e pneus.", "ativo": true, "ordem": 1 },
  { "nome": "Polimento Técnico", "preco": 250, "duracao": "4-6h", "descricao": "Remoção de riscos, oxidação e imperfeições com polimento de 1 a 3 etapas.", "ativo": true, "ordem": 2 },
  { "nome": "Vitrificação", "preco": 800, "duracao": "1 dia", "descricao": "Proteção de longa duração com camada cerâmica. Brilho intenso e hidrofobicidade.", "ativo": true, "ordem": 3 },
  { "nome": "Higienização Interna", "preco": 200, "duracao": "3-4h", "descricao": "Limpeza profunda de bancos, tapetes, teto e painel. Eliminação de odores.", "ativo": true, "ordem": 4 },
  { "nome": "PPF — Proteção de Pintura", "preco": 0, "duracao": "Variável", "descricao": "Película poliuretano invisível contra pedriscos e arranhões.", "ativo": true, "ordem": 5 },
  { "nome": "Lavagem Premium", "preco": 150, "duracao": "2-3h", "descricao": "Lavagem + cera + plásticos + brilho de pneus. O melhor custo-benefício.", "ativo": true, "ordem": 6 }
]
```

### 3. Collection: `testimonials`

Crie 4 documentos com **IDs automáticos**:

```json
[
  { "nome": "Marcos A.", "veiculo": "Honda Civic", "texto": "Levei meu Civic para polimento e fiquei impressionado. A pintura ficou como saída de fábrica. Profissionalismo total do início ao fim.", "estrelas": 5, "ativo": true, "ordem": 1 },
  { "nome": "Rodrigo S.", "veiculo": "Toyota Corolla", "texto": "Fiz a vitrificação e 8 meses depois o carro continua com brilho incrível. A água literalmente escorrega. Serviço de altíssima qualidade!", "estrelas": 5, "ativo": true, "ordem": 2 },
  { "nome": "Ana C.", "veiculo": "Volkswagen T-Cross", "texto": "Higienização interna impecável. Meu carro tinha odor de cigarro que ninguém conseguia tirar. Depois do serviço ficou como novo por dentro!", "estrelas": 5, "ativo": true, "ordem": 3 },
  { "nome": "Felipe M.", "veiculo": "Chevrolet Onix", "texto": "Preço justo, atendimento excelente e resultado que supera as expectativas. Já indiquei para todos os meus amigos e família. Parabéns!", "estrelas": 5, "ativo": true, "ordem": 4 }
]
```

---

## 📊 Índices Compostos (Firestore)

Criar em **Firestore → Índices → Adicionar índice**:

### Índice 1: `appointments`
- Collection: `appointments`
- Campo 1: `data` (Ascending)
- Campo 2: `createdAt` (Descending)

### Índice 2: `transactions`
- Collection: `transactions`
- Campo 1: `data` (Ascending)
- Campo 2: `createdAt` (Descending)

---

## 💰 Custos do Plano Blaze

### Limites Gratuitos (Suficientes para o MVP)

| Serviço | Limite Grátis | Custo se Exceder |
|---------|---------------|------------------|
| **Firestore Reads** | 50.000/dia | $0.06/100K |
| **Firestore Writes** | 20.000/dia | $0.18/100K |
| **Storage** | 5 GB total | $0.026/GB/mês |
| **Downloads** | 1 GB/dia | $0.12/GB |
| **Auth (verificações)** | 10.000/mês | Grátis |

### Estimativa Mensal (Brilho Car)
- 📊 ~100 agendamentos/mês
- 📸 ~50 fotos (antes/depois)
- 💾 ~100 MB de dados

**Custo estimado: $0 - $2/mês** (dentro do free tier na maioria dos casos)

### ⚠️ Configurar Alertas de Orçamento
1. **Configurações do projeto** → **Uso e faturamento**
2. **Detalhes e configurações** → **Alertas**
3. Criar alerta para **$5** (para ser avisado antes de qualquer cobrança significativa)

---

## 🧪 Testar a Conexão

Depois de tudo configurado:

1. Abra `index.html` no navegador
2. Abra o **Console do navegador** (F12)
3. Deve aparecer: `[Firebase] Firebase conectado ✅ brilhocar-estetica`
4. Acesse `admin/index.html`
5. Tente login com: `admin@brilhocar.com` / `BrilhoCar2025!`

---

## 📋 Checklist Final

- [x] Criar projeto Firebase `brilhocar-estetica`
- [x] Upgrade para plano Blaze
- [x] Configurar Firebase no app Web
- [x] Adicionar credenciais em `firebase-config.js`
- [ ] **Storage**: Criar bucket (US-EAST1)
- [ ] **Storage**: Colar regras de segurança
- [ ] **Authentication**: Habilitar Email/Password
- [ ] **Authentication**: Criar usuário admin
- [ ] **Firestore**: Criar banco (southamerica-east1)
- [ ] **Firestore**: Colar regras de segurança
- [ ] **Firestore**: Criar collection `settings/business`
- [ ] **Firestore**: Criar collection `services` (6 docs)
- [ ] **Firestore**: Criar collection `testimonials` (4 docs)
- [ ] **Firestore**: Criar índices compostos
- [ ] **Alertas**: Configurar alerta de orçamento
- [ ] **Teste**: Verificar conexão no site
- [ ] **Teste**: Login admin funcionando
