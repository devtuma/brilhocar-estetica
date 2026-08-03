import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Configurações extraídas do firebase-config.js legado
const firebaseConfig = {
  apiKey: 'AIzaSyO8FaR87F73AkRLMFXJxFVJg4XFQJKVPQM',
  authDomain: 'brilhocar-estetica.firebaseapp.com',
  projectId: 'brilhocar-estetica',
  storageBucket: 'brilhocar-estetica.firebasestorage.app',
  messagingSenderId: '542562856492',
  appId: '1:542562856492:web:cafb728b8bb1d086c2eb89'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };
