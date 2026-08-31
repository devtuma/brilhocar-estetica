# 🚀 GUIA ULTRA-SIMPLES: Migrar Projeto Firebase

## Tempo estimado: 15-30 minutos

---

## O QUE VOCÊ PRECISA FAZER

São **3 partes**:

### PARTE 1: Exportar do Projeto Antigo (5 min)
```bash
# 1. Abra o terminal na pasta do projeto
cd "BrilhoCar Estetica Automotiva"

# 2. Logue no Firebase (se precisar)
firebase login

# 3. Exporte as regras
firebase firestore:rules:get --project brilhocar-estetica-9f14b > firestore.rules
firebase storage:rules:get --project brilhocar-estetica-9f14b > storage.rules

# 4. Exporte usuários (se houver)
firebase auth:export usuarios.json --format=json --project brilhocar-estetica-9f14b

# 5. Liste suas Functions
firebase functions:list --project brilhocar-estetica-9f14b
```
**Resultado:** Arquivos `firestore.rules`, `storage.rules`, `usuarios.json`

---

### PARTE 2: Configurar Projeto Novo no Firebase Console (5 min)

1. Acesse https://console.firebase.google.com
2. Clique em **"Adicionar projeto"**
3. Dê um nome (ex: `estetica-jardim`)
4. **Ative estes serviços:**
   - Authentication → "Começar" → Habilite "Email/Senha"
   - Firestore → "Criar banco de dados" → Região: `southamerica-east1`
   - Storage → "Começar"
   - Functions → "Começar" (vai pedir plano Blaze)

5. **Obtenha as credenciais:**
   - Vá em **Configurações do Projeto** → **Seus apps** → **Web** (</>)
   - Copie o `firebaseConfig`

---

### PARTE 3: Deploy no Projeto Novo (5 min)

```bash
# 1. Vincule o novo projeto
firebase use --add
# Selecione: estetica-jardim (seu novo projeto)

# 2. Deploy regras
firebase deploy --only firestore:rules,storage:rules

# 3. Deploy Functions
cd functions
firebase deploy --only functions
cd ..

# 4. Deploy Hosting
npm run build
firebase deploy --only hosting
```

---

## ARQUIVOS COPIADOS PARA VOCÊ

Na pasta `migration-export/`:
```
migration-export/
├── firestore.rules     ← Copie para a pasta do projeto
├── storage.rules       ← Copie para a pasta do projeto
├── README-MIGRATION.txt
└── deploy-novo-projeto.bat
```

---

## ⚠️ O QUE NÃO COPIA AUTOMATICAMENTE

| Item | Você precisa fazer |
|------|-------------------|
| Chave API do Asaas | Copiar do .env.local antigo |
| Webhook do Asaas | Configurar de novo no painel do Asaas |
| Domínio customizado | Configurar DNS de novo |
| Billing/Cartão | Configurar de novo |

---

## SE DER ERRO

### "Permission denied"
```bash
gcloud auth login
```

### "Bucket does not exist"
Criar bucket no Google Cloud Console:
```bash
gcloud storage buckets create gs://nome-do-bucket --project=projeto-novo
```

### Functions não deployam
Verifique se tem **plano Blaze** (não Spark)

---

## VERIFICAÇÃO FINAL

Depois de tudo, teste:
1. ✅ Login funciona? → Acesse /login e teste
2. ✅ Admin funciona? → Acesse /admin
3. ✅ Upload de imagem? → /admin/galeria → Novo Item
4. ✅ PIX funciona? → Faça um agendamento teste

---

## 📞 PRECISANDO DE AJUDA?

Me chame com:
- O nome do projeto novo
- A mensagem de erro exata
- Em qual passo parou
