
# Informações do Projeto Firebase

Projeto ID: brilhocar-estetica-9f14b

## Como usar estas configurações:

1. Crie um novo projeto Firebase
2. Ative os mesmos serviços (Firestore, Storage, Functions, Auth)
3. Copie os arquivos .rules para o novo projeto
4. Deploy as regras: firebase deploy --only firestore:rules,storage:rules

## Para migrar usuários:

firebase auth:export auth-export.json --format=json --project brilhocar-estetica-9f14b
firebase auth:import auth-export.json --project NOVO-PROJECT-ID

## Para copiar arquivos do Storage:

gcloud storage cp -r gs://bucket-antigo/* gs://bucket-novo/

## Arquivos exportados:
- firestore.rules    → Regras de segurança do Firestore
- storage.rules      → Regras de segurança do Storage
- functions-list.txt → Lista das Cloud Functions
- firestore.indexes.json → Índices do Firestore
