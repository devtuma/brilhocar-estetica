// Cole isso no Cloud Shell
const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore({ databaseId: '(default)' });

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
  updatedAt: Firestore.FieldValue.serverTimestamp()
};

db.doc('config/main').set(config, { merge: true })
  .then(() => console.log('✅ Config criada com sucesso!'))
  .catch(err => { console.error('❌ Erro:', err.message); process.exit(1); });