import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: '.env.local' });

// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// ============================================
// CONFIGURAÇÕES ASAAS
// ============================================
const ASAAS_BASE_URL = functions.config().asaas?.environment === 'sandbox'
  ? 'https://api-sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3';

const ASAAS_API_KEY = functions.config().asaas?.api_key || process.env.ASAAS_API_KEY || '';

// Headers para API Asaas
const asaasHeaders = {
  'access_token': ASAAS_API_KEY,
  'Content-Type': 'application/json'
};

// ============================================
// TIPOS
// ============================================
interface AsaasCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpfCnpj: string | null;
}

interface AsaasPayment {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  netValue: number;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'CANCELLED';
  dueDate: string;
  paymentDate: string | null;
  pixQrCode: string | null;
  pixQrCodeUrl: string | null;
  invoiceUrl: string | null;
  invoiceNumber: string | null;
  description: string | null;
}

export interface PixPaymentResult {
  success: boolean;
  paymentId?: string;
  qrCode?: string;
  qrCodeImage?: string;
  payload?: string;
  expiresAt?: string;
  error?: string;
}

// ============================================
// FUNÇÕES ASAAS
// ============================================

/**
 * Criar ou buscar cliente no Asaas
 */
async function getOrCreateAsaasCustomer(userData: {
  name: string;
  celular: string;
  email?: string;
}): Promise<string> {
  const celularLimpo = userData.celular.replace(/\D/g, '');

  try {
    // Buscar cliente existente pelo telefone
    const response = await axios.get(`${ASAAS_BASE_URL}/customers`, {
      headers: asaasHeaders,
      params: { phone: celularLimpo }
    });

    if (response.data.data && response.data.data.length > 0) {
      console.log(`Cliente Asaas encontrado: ${response.data.data[0].id}`);
      return response.data.data[0].id;
    }
  } catch (error: any) {
    console.log('Cliente não encontrado, criando novo...', error?.message);
  }

  // Criar novo cliente
  const customerData: Partial<AsaasCustomer> = {
    name: userData.name,
    phone: celularLimpo,
  };

  if (userData.email) {
    customerData.email = userData.email;
  }

  try {
    const response = await axios.post(`${ASAAS_BASE_URL}/customers`, customerData, {
      headers: asaasHeaders
    });
    console.log(`Cliente Asaas criado: ${response.data.id}`);
    return response.data.id;
  } catch (error: any) {
    console.error('Erro ao criar cliente Asaas:', error?.response?.data || error?.message);
    throw new Error('Falha ao criar cliente no Asaas');
  }
}

/**
 * Criar pagamento PIX
 */
async function createPixPayment(
  customerId: string,
  amount: number,
  description: string
): Promise<{ paymentId: string; qrCode: string; payload: string; expiresAt: string }> {
  // Calcular data de expiração (30 minutos)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const dueDate = expiresAt.toISOString().split('T')[0];

  // Criar pagamento PIX
  const paymentData = {
    customer: customerId,
    billingType: 'PIX',
    value: amount,
    dueDate: dueDate,
    description: description
  };

  console.log(`Criando PIX: amount=${amount}, customer=${customerId}`);

  const paymentResponse = await axios.post(`${ASAAS_BASE_URL}/payments`, paymentData, {
    headers: asaasHeaders
  });

  const payment: AsaasPayment = paymentResponse.data;
  console.log(`PIX criado: ${payment.id}, status=${payment.status}`);

  // Obter QR Code PIX
  const qrResponse = await axios.get(`${ASAAS_BASE_URL}/payments/${payment.id}/pixQrCode`, {
    headers: asaasHeaders
  });

  return {
    paymentId: payment.id,
    qrCode: qrResponse.data.encodedImage || '',
    payload: qrResponse.data.payload || '',
    expiresAt: expiresAt.toISOString()
  };
}

/**
 * Verificar status do pagamento
 */
async function checkPaymentStatus(paymentId: string): Promise<string> {
  const response = await axios.get(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
    headers: asaasHeaders
  });

  const payment: AsaasPayment = response.data;

  // Mapear status Asaas para status internos
  switch (payment.status) {
    case 'RECEIVED':
    case 'CONFIRMED':
      return 'paid';
    case 'OVERDUE':
      return 'expired';
    case 'CANCELLED':
      return 'cancelled';
    case 'PENDING':
    default:
      return 'pending';
  }
}

// ============================================
// FUNÇÕES FIREBASE CLOUD
// ============================================

/**
 * Criar pagamento PIX para um agendamento
 */
export const createPixPaymentForAppointment = functions.https.onCall(async (data, context) => {
  // Verificar autenticação
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { appointmentId } = data;

  if (!appointmentId) {
    throw new functions.https.HttpsError('invalid-argument', 'ID do agendamento é obrigatório');
  }

  // Buscar agendamento
  const appointmentRef = db.collection('appointments').doc(appointmentId);
  const appointmentDoc = await appointmentRef.get();

  if (!appointmentDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Agendamento não encontrado');
  }

  const appointment = appointmentDoc.data()!;

  // Verificar se o usuário é dono do agendamento ou admin
  const userId = context.auth.uid;

  if (appointment.userId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Sem permissão para este agendamento');
  }

  // Verificar se já existe pagamento PIX
  if (appointment.pixPaymentId) {
    // Retornar pagamento existente
    return {
      success: true,
      paymentId: appointment.pixPaymentId,
      qrCode: appointment.pixQrCodeImage,
      payload: appointment.pixQrCode,
      expiresAt: appointment.pixExpiresAt?.toDate?.()?.toISOString() || null,
      alreadyExists: true
    };
  }

  // Buscar dados do usuário
  const userRef = db.collection('users').doc(appointment.userId);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  if (!userData) {
    throw new functions.https.HttpsError('not-found', 'Usuário não encontrado');
  }

  // Buscar configuração PIX
  const configRef = db.collection('config').doc('main');
  const configDoc = await configRef.get();
  const config = configDoc.data() || {};
  const pixConfig = config.pixConfig || {};

  // Calcular valor do sinal (30% do total, mínimo R$ 20)
  const totalPrice = appointment.totalPrice || 0;
  let pixAmount = pixConfig.guaranteePercentage
    ? totalPrice * (pixConfig.guaranteePercentage / 100)
    : totalPrice * 0.3;

  // Valor mínimo
  const minAmount = pixConfig.minGuaranteeAmount || 20;
  if (pixAmount < minAmount) {
    pixAmount = minAmount;
  }

  // Arredondar para 2 casas decimais
  pixAmount = Math.round(pixAmount * 100) / 100;

  try {
    // Criar ou buscar cliente no Asaas
    const customerId = await getOrCreateAsaasCustomer({
      name: appointment.userName || userData.name || 'Cliente',
      celular: appointment.userCelular || userData.celular || '',
      email: userData.email || undefined
    });

    // Criar pagamento PIX
    const description = `Sinal agendamento #${appointment.os || appointmentId}`;
    const pixResult = await createPixPayment(customerId, pixAmount, description);

    // Atualizar agendamento no Firestore
    await appointmentRef.update({
      pixPaymentId: pixResult.paymentId,
      pixAmount: pixAmount,
      pixQrCode: pixResult.payload,
      pixQrCodeImage: pixResult.qrCode,
      pixStatus: 'pending',
      pixExpiresAt: admin.firestore.Timestamp.fromDate(new Date(pixResult.expiresAt)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Pagamento PIX criado com sucesso: ${pixResult.paymentId}`);

    return {
      success: true,
      paymentId: pixResult.paymentId,
      qrCode: pixResult.qrCode,
      payload: pixResult.payload,
      expiresAt: pixResult.expiresAt,
      pixAmount: pixAmount
    };

  } catch (error: any) {
    console.error('Erro ao criar pagamento PIX:', error);

    throw new functions.https.HttpsError(
      'internal',
      `Erro ao criar pagamento: ${error.message || 'Erro desconhecido'}`
    );
  }
});

/**
 * Verificar status do pagamento PIX
 */
export const checkPixPaymentStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { paymentId, appointmentId } = data;

  try {
    let status: string;

    if (paymentId) {
      // Buscar pelo paymentId
      status = await checkPaymentStatus(paymentId);
    } else if (appointmentId) {
      // Buscar pelo appointmentId
      const appointmentRef = db.collection('appointments').doc(appointmentId);
      const appointmentDoc = await appointmentRef.get();

      if (!appointmentDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Agendamento não encontrado');
      }

      const appointment = appointmentDoc.data()!;

      if (appointment.userId !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Sem permissão');
      }

      if (!appointment.pixPaymentId) {
        return { status: 'no_payment' };
      }

      status = await checkPaymentStatus(appointment.pixPaymentId);
    } else {
      throw new functions.https.HttpsError('invalid-argument', 'paymentId ou appointmentId é obrigatório');
    }

    return { status };

  } catch (error: any) {
    console.error('Erro ao verificar status:', error);

    throw new functions.https.HttpsError(
      'internal',
      `Erro ao verificar status: ${error.message || 'Erro desconhecido'}`
    );
  }
});

/**
 * Webhook do Asaas para receber notificações de pagamento
 */
export const asaasWebhook = functions.https.onRequest(async (req, res) => {
  // Apenas aceitar POST
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { payment, event } = req.body;

  // Validar que temos dados do pagamento
  if (!payment || !payment.id) {
    res.status(400).send('Invalid payload');
    return;
  }

  console.log(`Webhook recebido: evento=${event}, paymentId=${payment.id}, status=${payment.status}`);

  try {
    // Buscar agendamento pelo pixPaymentId
    const appointmentsSnapshot = await db.collection('appointments')
      .where('pixPaymentId', '==', payment.id)
      .limit(1)
      .get();

    if (appointmentsSnapshot.empty) {
      console.log(`Agendamento não encontrado para paymentId=${payment.id}`);
      res.status(200).send('Appointment not found');
      return;
    }

    const appointmentDoc = appointmentsSnapshot.docs[0];
    const appointmentRef = appointmentDoc.ref;

    // Processar evento
    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        // Pagamento confirmado!
        await appointmentRef.update({
          pixStatus: 'paid',
          pixPaidAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'Agendado',
          timeline: admin.firestore.FieldValue.arrayUnion({
            status: 'Agendado',
            date: new Date().toISOString(),
            note: 'Pagamento PIX confirmado via webhook'
          }),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Pagamento confirmado para agendamento ${appointmentDoc.id}`);
        break;
      }

      case 'PAYMENT_DELETED':
      case 'PAYMENT_UPDATED': {
        // Não fazer nada específico, apenas logar
        console.log(`Evento ${event} para paymentId=${payment.id}`);
        break;
      }
    }

    res.status(200).send('OK');

  } catch (error: any) {
    console.error('Erro no webhook:', error);
    res.status(500).send('Internal error');
  }
});

/**
 * Cancelar pagamento PIX pendente
 */
export const cancelPixPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { paymentId } = data;

  if (!paymentId) {
    throw new functions.https.HttpsError('invalid-argument', 'paymentId é obrigatório');
  }

  try {
    // Cancelar no Asaas
    await axios.post(`${ASAAS_BASE_URL}/payments/${paymentId}/cancel`, {}, {
      headers: asaasHeaders
    });

    // Atualizar status no Firestore
    const appointmentsSnapshot = await db.collection('appointments')
      .where('pixPaymentId', '==', paymentId)
      .limit(1)
      .get();

    if (!appointmentsSnapshot.empty) {
      const appointmentRef = appointmentsSnapshot.docs[0].ref;
      await appointmentRef.update({
        pixStatus: 'cancelled',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return { success: true };

  } catch (error: any) {
    console.error('Erro ao cancelar pagamento:', error);

    throw new functions.https.HttpsError(
      'internal',
      `Erro ao cancelar: ${error.message || 'Erro desconhecido'}`
    );
  }
});

/**
 * Criar transação no histórico (salva localmente)
 */
export const saveTransaction = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { appointmentId, asaasId, amount, status } = data;

  // Verificar se é admin ou dono do agendamento
  const appointmentRef = db.collection('appointments').doc(appointmentId);
  const appointmentDoc = await appointmentRef.get();

  if (!appointmentDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Agendamento não encontrado');
  }

  const appointment = appointmentDoc.data()!;

  if (appointment.userId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Sem permissão');
  }

  // Salvar transação
  const transactionRef = db.collection('transactions').doc();
  await transactionRef.set({
    appointmentId,
    asaasId,
    amount,
    status,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, transactionId: transactionRef.id };
});

// ============================================
// FUNÇÕES SCHEDULED (CRON)
// ============================================

/**
 * Verificar pagamentos expirados (executa a cada 5 minutos)
 */
export const checkExpiredPayments = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const now = new Date();

    // Buscar pagamentos pendentes que já expiraram
    const expiredQuery = await db.collection('appointments')
      .where('pixStatus', '==', 'pending')
      .where('pixExpiresAt', '<', now)
      .get();

    const batch = db.batch();

    expiredQuery.docs.forEach(doc => {
      batch.update(doc.ref, {
        pixStatus: 'expired',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    console.log(`Verificados ${expiredQuery.size} pagamentos expirados`);
    return null;
  });
