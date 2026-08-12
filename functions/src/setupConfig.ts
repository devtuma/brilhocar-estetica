// Cloud Function temporária para criar config no Firestore
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const setupInitialConfig = onRequest(async (req, res) => {
  // Permitir apenas do seu IP ou com autenticação
  const config = {
    pixConfig: {
      guaranteePercentage: 30,
      minGuaranteeAmount: 20,
      pixRecipientName: 'BrilhoCar Estética',
    },
    businessHours: {
      monday: { active: true, close: '18:00', open: '08:00' },
      tuesday: { active: true, close: '18:00', open: '08:00' },
      wednesday: { active: true, close: '18:00', open: '08:00' },
      thursday: { active: true, close: '18:00', open: '08:00' },
      friday: { active: true, close: '18:00', open: '08:00' },
      saturday: { active: true, close: '14:00', open: '09:00' },
      sunday: { active: false, close: '00:00', open: '00:00' },
    },
    activePromotion: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  try {
    await admin.firestore().doc('config/main').set(config, { merge: true });
    res.json({ ok: true, message: 'Config criada com sucesso!' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});