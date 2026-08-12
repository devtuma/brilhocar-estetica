const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env.local' });

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'brilhocar-estetica-9f14b'
});

const db = admin.firestore();

async function createConfig() {
  const config = {
    pixConfig: {
      guaranteePercentage: 30,
      minGuaranteeAmount: 20,
      pixRecipientName: 'BrilhoCar Estética',
    },
    businessHours: {
      monday: { open: '08:00', close: '18:00', active: true },
      tuesday: { open: '08:00', close: '18:00', active: true },
      wednesday: { open: '08:00', close: '18:00', active: true },
      thursday: { open: '08:00', close: '18:00', active: true },
      friday: { open: '08:00', close: '18:00', active: true },
      saturday: { open: '09:00', close: '14:00', active: true },
      sunday: { open: '00:00', close: '00:00', active: false },
    },
    activePromotion: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.doc('config/main').set(config, { merge: true });
    console.log('✅ Configuração criada com sucesso!');
  } catch (error) {
    console.error('❌ Erro:', error);
  }
  process.exit();
}

createConfig();
