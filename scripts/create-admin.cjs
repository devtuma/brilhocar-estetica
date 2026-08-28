// Cria usuário admin no Firebase Auth + adiciona em /admins
require('dotenv').config({ path: '.env' });
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);

const email = process.argv[2] || 'admin@brilhocar.com';
const password = process.argv[3] || 'BrilhoCar@2026';
const name = process.argv[4] || 'Administrador';

(async () => {
  try {
    console.log('Criando usuário', email, '...');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    console.log('UID:', uid);

    console.log('Adicionando à collection /admins ...');
    await setDoc(doc(db, 'admins', uid), {
      email,
      name,
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString(),
    });

    console.log('✅ Admin criado com sucesso!');
    console.log('Email:', email);
    console.log('Senha:', password);
    console.log('UID:', uid);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log('⚠️  Email já existe. Tentando login...');
      const { signInWithEmailAndPassword } = require('firebase/auth');
      const cred2 = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login OK. UID:', cred2.user.uid);
    } else {
      console.error('❌ Erro:', err.code, err.message);
    }
  }
  process.exit(0);
})();
