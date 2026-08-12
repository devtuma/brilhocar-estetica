import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createConfig() {
  const pixKey = process.env.ASAAS_PIX_KEY || '';

  const config = {
    // Configuração PIX
    pixConfig: {
      guaranteePercentage: 30,      // 30% de sinal
      minGuaranteeAmount: 20,       // mínimo R$ 20
      pixKey: pixKey,              // sua chave PIX
      pixRecipientName: 'BrilhoCar Estética',
      //ASAAS_API_KEY removida - não deve ser exposta
    },

    // Horários de funcionamento
    businessHours: {
      monday: { open: '08:00', close: '18:00', active: true },
      tuesday: { open: '08:00', close: '18:00', active: true },
      wednesday: { open: '08:00', close: '18:00', active: true },
      thursday: { open: '08:00', close: '18:00', active: true },
      friday: { open: '08:00', close: '18:00', active: true },
      saturday: { open: '09:00', close: '14:00', active: true },
      sunday: { open: '00:00', close: '00:00', active: false },
    },

    // Promoções ativas (inicialmente vazio)
    activePromotion: null,

    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'config', 'main'), config, { merge: true });
    console.log('✅ Configuração criada com sucesso!');
    console.log('📝 Lembre-se de adicionar sua chave PIX no painel do Asaas');
  } catch (error) {
    console.error('❌ Erro ao criar configuração:', error);
  }
}

createConfig();
