// Criar usuários de teste via Firebase Admin (rodar uma vez)
// Cria contas Cliente A e Cliente B para teste de anti-duplo-booking

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-admin-key.json'); // você precisa baixar do console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const TEST_USERS = [
  {
    email: '+5511999990001@brilhocar.com',
    password: 'Teste@123',
    name: 'Cliente A Teste',
    celular: '11999990001',
  },
  {
    email: '+5511999990002@brilhocar.com',
    password: 'Teste@123',
    name: 'Cliente B Teste',
    celular: '11999990002',
  },
  {
    email: 'admin@brilhocar.com',
    password: 'admin123',
    name: 'Admin Teste',
    celular: '11999990000',
    admin: true,
  },
];

async function createTestUsers() {
  for (const u of TEST_USERS) {
    try {
      const user = await admin.auth().createUser({
        email: u.email,
        password: u.password,
        displayName: u.name,
      });
      console.log(`✅ Criado: ${u.email} (uid: ${user.uid})`);

      // Criar documento users/{uid}
      await admin.firestore().collection('users').doc(user.uid).set({
        name: u.name,
        celular: u.celular,
        email: u.email,
        passwordSet: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Se for admin, adicionar à coleção admins
      if (u.admin) {
        await admin.firestore().collection('admins').doc(user.uid).set({
          email: u.email,
          role: 'admin',
          addedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`   → Admin adicionado`);
      }
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        console.log(`⚠️ Já existe: ${u.email}`);
      } else {
        console.error(`❌ Erro ao criar ${u.email}:`, err.message);
      }
    }
  }
  console.log('\n🎉 Test users criados!');
  process.exit(0);
}

createTestUsers();
