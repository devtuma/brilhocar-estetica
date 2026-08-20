// Limpar agendamentos de TESTE criados durante o E2E
// IDs: EOjMhbPaN7lJcuXsR3jd, KUsEl3rm5oITW98ow8LT, Zks4qqkaBQpSgOFmyqpT

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const TEST_IDS = [
  'EOjMhbPaN7lJcuXsR3jd',
  'KUsEl3rm5oITW98ow8LT',
  'Zks4qqkaBQpSgOFmyqpT'
];

async function cleanup() {
  console.log('Limpando agendamentos de teste...\n');

  for (const id of TEST_IDS) {
    try {
      await admin.firestore().collection('appointments').doc(id).delete();
      console.log(`✅ Deletado: ${id}`);
    } catch (err) {
      console.log(`⚠️ Erro ao deletar ${id}: ${err.message}`);
    }
  }

  console.log('\n✅ Limpeza concluída!');
  process.exit(0);
}

cleanup();
