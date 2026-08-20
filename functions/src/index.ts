import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as dotenv from 'dotenv';
const cors = require('cors');

// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: '.env.local' });

// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// ============================================
// CONFIGURAÇÕES ASAAS
// ============================================
const ASAAS_BASE_URL = functions.config().asaas?.environment === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

const ASAAS_API_KEY = functions.config().asaas?.api_key || process.env.ASAAS_API_KEY || '';

// Log para debug (apenas primeiros 10 chars) - ajuda a diagnosticar problemas de config
console.log(`[Asaas] URL: ${ASAAS_BASE_URL}`);
console.log(`[Asaas] API Key presente: ${ASAAS_API_KEY ? 'SIM (length=' + ASAAS_API_KEY.length + ')' : 'NÃO - VAZIO!'}`);

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
  externalReference?: string | null;
  notificationDisabled?: boolean;
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
  cpfCnpj?: string;
}): Promise<string> {
  const celularLimpo = userData.celular.replace(/\D/g, '');

  // IMPORTANTE: Asaas sandbox EXIGE CPF/CNPJ para criar pagamentos PIX
  // CPFs de teste válidos para Asaas sandbox: 12345678909, 11144477735, etc.
  // Se não informar, geramos a partir do celular (fixo, determinístico)
  const cpfCnpj = userData.cpfCnpj || gerarCpfFromCelular(celularLimpo);

  try {
    // Buscar cliente existente pelo CPF (mais confiável)
    const response = await axios.get(`${ASAAS_BASE_URL}/customers`, {
      headers: asaasHeaders,
      params: { cpfCnpj }
    });

    if (response.data.data && response.data.data.length > 0) {
      console.log(`Cliente Asaas encontrado: ${response.data.data[0].id}`);
      return response.data.data[0].id;
    }
  } catch (error: any) {
    console.log('Busca de cliente falhou (normal se não existe), criando novo...', error?.message);
  }

  // Criar novo cliente
  // IMPORTANTE: Asaas EXIGE CPF/CNPJ para criar pagamento PIX
  const customerData: Partial<AsaasCustomer> = {
    name: userData.name,
    phone: celularLimpo,
    cpfCnpj: cpfCnpj,
    externalReference: `celular:${celularLimpo}`,
    notificationDisabled: false,
  };

  if (userData.email) {
    customerData.email = userData.email;
  } else {
    customerData.email = `${celularLimpo}@brilhocar.com.br`;
  }

  try {
    const response = await axios.post(`${ASAAS_BASE_URL}/customers`, customerData, {
      headers: asaasHeaders
    });
    console.log(`Cliente Asaas criado: ${response.data.id} (cpf=${cpfCnpj})`);
    return response.data.id;
  } catch (error: any) {
    const status = error?.response?.status;
    const errorBody = error?.response?.data;
    console.error('Erro ao criar cliente Asaas:', {
      status,
      body: errorBody,
      message: error?.message,
      sentData: customerData
    });
    throw new Error(`Falha ao criar cliente no Asaas (${status}): ${JSON.stringify(errorBody?.errors?.[0]?.description || errorBody || error?.message)}`);
  }
}

/**
 * Calcula os dígitos verificadores de um CPF (para gerar CPFs válidos)
 */
function calcularDigitosCpf(base: number[]): [number, number] {
  // Primeiro dígito verificador
  let soma1 = 0;
  for (let i = 0; i < 9; i++) {
    soma1 += base[i] * (10 - i);
  }
  let resto1 = soma1 % 11;
  const dig1 = resto1 < 2 ? 0 : 11 - resto1;

  // Segundo dígito verificador
  const base2 = [...base, dig1];
  let soma2 = 0;
  for (let i = 0; i < 10; i++) {
    soma2 += base2[i] * (11 - i);
  }
  let resto2 = soma2 % 11;
  const dig2 = resto2 < 2 ? 0 : 11 - resto2;

  return [dig1, dig2];
}

/**
 * Gera um CPF válido (apenas para TESTES no Asaas sandbox)
 * Usa o número do celular para gerar digits base determinísticos
 */
function gerarCpfFromCelular(celular: string): string {
  // Pega os primeiros 9 dígitos do celular (ou usa seed se celular curto)
  const celularDigits = celular.replace(/\D/g, '').split('').map(Number);

  // Usa os últimos 9 dígitos do celular (ou padding se necessário)
  const baseDigits: number[] = [];
  const startIdx = Math.max(0, celularDigits.length - 9);
  for (let i = 0; i < 9; i++) {
    baseDigits.push(celularDigits[startIdx + i] ?? (i + 1));
  }

  const [dig1, dig2] = calcularDigitosCpf(baseDigits);
  const cpf = [...baseDigits, dig1, dig2].join('');

  console.log(`[CPF] Gerado CPF válido: ${cpf} (celular=${celular})`);
  return cpf;
}


/**
 * Criar pagamento PIX
 * IMPORTANTE: Expira em 10 minutos para liberar slot para outras pessoas
 */
async function createPixPayment(
  customerId: string,
  amount: number,
  description: string,
  pixKey?: string
): Promise<{ paymentId: string; qrCode: string; payload: string; expiresAt: string }> {
  // Calcular data de expiração (10 minutos)
  // Após 10min sem pagamento, o slot é liberado para outra pessoa agendar
  const PIX_EXPIRATION_MINUTES = 10;
  const expiresAt = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000);
  const dueDate = expiresAt.toISOString().split('T')[0];

  // Criar pagamento PIX
  // Se pixKey foi passada, usar como chave específica (precisa estar cadastrada na conta Asaas)
  const paymentData: any = {
    customer: customerId,
    billingType: 'PIX',
    value: amount,
    dueDate: dueDate,
    description: description
  };

  // Se tem chave PIX configurada pelo admin, passar como endereço da chave PIX
  // Caso contrário, Asaas usa a chave padrão da conta
  if (pixKey && pixKey.trim().length > 0) {
    paymentData.pix = {
      addressKey: pixKey.trim()
    };
  }

  console.log(`Criando PIX: amount=${amount}, customer=${customerId}, pixKey=${pixKey ? 'sim' : 'não'}`);

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

  // Calcular valor do sinal
  const totalPrice = appointment.totalPrice || 0;
  let pixAmount = pixConfig.guaranteePercentage
    ? totalPrice * (pixConfig.guaranteePercentage / 100)
    : totalPrice * 0.3;

  // Valor mínimo
  // IMPORTANTE: Asaas sandbox REJEITA pagamentos PIX menores que R$ 5,00
  // (API retorna: "O valor da cobrança não pode ser menor que R$ 5,00")
  // Em produção, o valor mínimo continua sendo configurável pelo admin.
  const minAmount = pixConfig.minGuaranteeAmount || 5;

  // Primeiro: garantir que o valor não exceda o total (para serviços baratos)
  // Depois: garantir que o valor não seja menor que o mínimo
  if (totalPrice > 0 && pixAmount > totalPrice) {
    pixAmount = totalPrice;
  }

  // IMPORTANTE: verificar o mínimo DEPOIS de ajustar contra o totalPrice
  // Para serviços baratos (ex: R$ 3,33 com 30% = R$ 1,00), forçamos R$ 5,00
  // O sinal pode ser maior que o serviço? Sim, é um valor fixo de garantia.
  if (pixAmount < minAmount) {
    pixAmount = minAmount;
  }

  // Arredondar para 2 casas decimais
  pixAmount = Math.round(pixAmount * 100) / 100;

  console.log(`[PIX] Calculando: totalPrice=${totalPrice}, percentage=${pixConfig.guaranteePercentage}%, initialPixAmount=${totalPrice * (pixConfig.guaranteePercentage / 100)}, minAmount=${minAmount}, finalPixAmount=${pixAmount}`);

  try {
    // Criar ou buscar cliente no Asaas
    const customerId = await getOrCreateAsaasCustomer({
      name: appointment.userName || userData.name || 'Cliente',
      celular: appointment.userCelular || userData.celular || '',
      email: userData.email || undefined,
      cpfCnpj: userData.cpfCnpj || undefined
    });

    // Criar pagamento PIX
    // Passar pixKey configurada pelo admin (se houver) para o Asaas
    const description = `Sinal agendamento #${appointment.os || appointmentId}`;
    const pixResult = await createPixPayment(customerId, pixAmount, description, pixConfig.pixKey);

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
    console.error('Erro ao criar pagamento PIX:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      errors: error?.response?.data?.errors,
      ASAAS_API_KEY_LENGTH: ASAAS_API_KEY.length
    });

    // Extrair mensagem de erro detalhada do Asaas
    const asaasErrors = error?.response?.data?.errors;
    let errorMessage = 'Erro desconhecido';
    if (asaasErrors && Array.isArray(asaasErrors) && asaasErrors.length > 0) {
      errorMessage = asaasErrors.map(e => e.description || e.message || JSON.stringify(e)).join('; ');
    } else if (error?.response?.data?.description) {
      errorMessage = error.response.data.description;
    } else if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else {
      errorMessage = error?.message || 'Erro desconhecido';
    }

    throw new functions.https.HttpsError(
      'internal',
      `Erro ao criar pagamento: ${errorMessage}`
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

  // SEGURANÇA: Validar token de acesso do Asaas
  // Documentação: https://docs.asaas.com/docs/webhooks-3
  // Configurar token no painel Asaas > Integrations > Webhooks
  const asaasAccessToken = req.headers['asaas-access-token'];
  const expectedToken = functions.config().asaas?.webhook_token || process.env.ASAAS_WEBHOOK_TOKEN;

  // SEGURANÇA: Webhook SEMPRE exige token configurado
  if (!expectedToken) {
    console.error('CRÍTICO: ASAAS_WEBHOOK_TOKEN não configurado. Webhook rejeitado por segurança.');
    res.status(503).json({
      error: 'Webhook não configurado. Defina ASAAS_WEBHOOK_TOKEN antes de usar em produção.',
      docs: 'https://docs.asaas.com/docs/webhooks-3'
    });
    return;
  }

  if (!asaasAccessToken || asaasAccessToken !== expectedToken) {
    console.warn('Webhook rejeitado: token inválido ou ausente');
    res.status(401).send('Unauthorized');
    return;
  }
  console.log('Webhook token validado ✅');

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

// ============================================
// FUNÇÕES ADMINISTRATIVAS - REMOVIDAS
// ============================================
// A função adminUpdateConfigHttp era temporária e foi REMOVIDA.
// Atualizar config via painel admin (frontend) que tem auth via Firebase Auth + Firestore rules.

/**
 * Bootstrap Admin - Adiciona o usuário atual como admin
 * IMPORTANTE: só funciona se o email do usuário estiver na lista de admins permitidos
 * Configurar via: functions.config().admin.emails = "email1@x.com,email2@y.com"
 * Ou variável de ambiente: ADMIN_EMAILS
 *
 * IMPORTANTE: Cloud Functions v1 com onCall NÃO tem CORS issue - é gerenciado pelo Firebase.
 * Se der erro de CORS, é provável que o domínio de origem não esteja autorizado.
 * Adicionar domínios em: Firebase Console > Authentication > Settings > Authorized Domains
 */
export const bootstrapAdmin = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const email = context.auth.token.email;
  const uid = context.auth.uid;

  if (!email) {
    throw new functions.https.HttpsError('failed-precondition', 'Email não disponível');
  }

  // Lista de emails admin permitidos (configurável)
  // IMPORTANTE: Como ainda não configuramos lista, na primeira vez aceita qualquer email
  // logado. Em produção, configure ADMIN_EMAILS para restringir.
  const allowedEmails = (functions.config().admin?.emails || process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => e.length > 0);

  // Se não configurado (lista vazia), aceita o primeiro admin (one-time bootstrap)
  // Em produção, configure a lista de emails permitidos via env var
  if (allowedEmails.length > 0 && !allowedEmails.includes(email.toLowerCase())) {
    throw new functions.https.HttpsError('permission-denied', `Email ${email} não autorizado. Configure ADMIN_EMAILS para liberar.`);
  }

  // Adicionar como admin na coleção
  await db.collection('admins').doc(uid).set({
    email,
    addedAt: admin.firestore.FieldValue.serverTimestamp(),
    role: 'admin'
  });

  console.log(`[bootstrapAdmin] Admin adicionado: ${email} (uid: ${uid})`);

  return {
    success: true,
    uid,
    email,
    message: `Admin ${email} configurado com sucesso! Agora pode salvar configs.`
  };
});

/**
 * Bootstrap Admin HTTP - Endpoint HTTP v1 com CORS manual
 * Alternativa para casos onde httpsCallable tem problemas de CORS
 * Uso: POST /bootstrapAdminHttp com header Authorization: Bearer <firebase-id-token>
 */
const corsHandler = cors({
  origin: true, // Aceita qualquer origem (em produção, especifique os domínios)
  credentials: false
});

export const bootstrapAdminHttp = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Validar método
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Método não permitido' });
      return;
    }

    try {
      // Pegar token do header Authorization
      const authHeader = req.headers.authorization || '';
      const idToken = authHeader.startsWith('Bearer ')
        ? authHeader.split('Bearer ')[1]
        : authHeader;

      if (!idToken) {
        res.status(401).json({ success: false, error: 'Token não fornecido' });
        return;
      }

      // Verificar token com Firebase Admin
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const email = decodedToken.email;

      if (!email) {
        res.status(400).json({ success: false, error: 'Email não disponível no token' });
        return;
      }

      // Adicionar como admin na coleção
      await db.collection('admins').doc(uid).set({
        email,
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
        role: 'admin'
      }, { merge: true });

      console.log(`[bootstrapAdminHttp] Admin adicionado: ${email} (uid: ${uid})`);

      res.status(200).json({
        success: true,
        uid,
        email,
        message: `Admin ${email} configurado com sucesso!`
      });
    } catch (err: any) {
      console.error('[bootstrapAdminHttp] Erro:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Erro ao processar'
      });
    }
  });
});

/**
 * Seed Services - Cria serviços padrão se a collection estiver vazia
 * Disponível apenas para admin
 */
export const seedServices = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  // Verificar se é admin
  const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminDoc.exists && context.auth.token.admin !== true) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas admin pode executar');
  }

  // Verificar se já tem serviços
  const existing = await db.collection('services').get();
  if (!existing.empty) {
    return {
      success: false,
      message: `Já existem ${existing.size} serviços cadastrados. Nenhum criado.`
    };
  }

  // Serviços padrão
  const defaultServices = [
    {
      id: 'lavagem-tecnica',
      name: 'Lavagem Técnica',
      description: 'Lavagem completa externa com produtos de alta performance',
      basePrice: 80,
      duration: 60,
      icon: 'Droplet',
      active: true,
      featured: true,
      order: 1
    },
    {
      id: 'lavagem-detalhada',
      name: 'Lavagem Detalhada',
      description: 'Lavagem minuciosa incluindo motor, rodas e detalhamento interno',
      basePrice: 150,
      duration: 90,
      icon: 'Sparkles',
      active: true,
      featured: false,
      order: 2
    },
    {
      id: 'polimento-tecnico',
      name: 'Polimento Técnico',
      description: 'Polimento profissional para remoção de riscos e oxidação',
      basePrice: 350,
      duration: 180,
      icon: 'Sun',
      active: true,
      featured: true,
      order: 3
    },
    {
      id: 'vitrificacao',
      name: 'Vitrificação',
      description: 'Vitrificação cerâmica com proteção de até 2 anos',
      basePrice: 1200,
      duration: 240,
      icon: 'Shield',
      active: true,
      featured: true,
      order: 4
    },
    {
      id: 'higienizacao-interna',
      name: 'Higienização Interna',
      description: 'Limpeza profunda de bancos, carpetes e painel',
      basePrice: 200,
      duration: 120,
      icon: 'Star',
      active: true,
      featured: false,
      order: 5
    },
    {
      id: 'tratamento-vidros',
      name: 'Tratamento de Vidros',
      description: 'Vidrificação de vidros com proteção UV e repelente',
      basePrice: 120,
      duration: 60,
      icon: 'Shield',
      active: true,
      featured: false,
      order: 6
    }
  ];

  const batch = db.batch();
  defaultServices.forEach(service => {
    const ref = db.collection('services').doc(service.id);
    batch.set(ref, {
      ...service,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();

  console.log(`[seedServices] ${defaultServices.length} serviços padrão criados`);

  return {
    success: true,
    message: `${defaultServices.length} serviços padrão criados com sucesso!`,
    count: defaultServices.length
  };
});

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

/**
 * SIMULAR PAGAMENTO - PARA TESTES ONLY
 * Esta função simula o que o webhook do Asaas faz quando recebe PAYMENT_RECEIVED
 * IMPORTANTE: REMOVER EM PRODUÇÃO!
 */
export const simulatePaymentConfirmed = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { paymentId, appointmentId } = data;

  if (!paymentId && !appointmentId) {
    throw new functions.https.HttpsError('invalid-argument', 'paymentId ou appointmentId é obrigatório');
  }

  try {
    let appointmentRef;

    if (appointmentId) {
      appointmentRef = db.collection('appointments').doc(appointmentId);
    } else {
      // Buscar pelo paymentId
      const snapshot = await db.collection('appointments')
        .where('pixPaymentId', '==', paymentId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new functions.https.HttpsError('not-found', 'Agendamento não encontrado');
      }
      appointmentRef = snapshot.docs[0].ref;
    }

    // Atualizar como se o webhook tivesse confirmado
    await appointmentRef.update({
      pixStatus: 'paid',
      pixPaidAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'Agendado',
      timeline: admin.firestore.FieldValue.arrayUnion({
        status: 'Agendado',
        date: new Date().toISOString(),
        note: '[TESTE] Pagamento PIX simulado'
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[TESTE] Pagamento simulado para appointment: ${appointmentRef.id}`);

    return {
      success: true,
      message: 'Pagamento simulado com sucesso! O onSnapshot deve detectar a mudança.'
    };
  } catch (error: any) {
    console.error('Erro ao simular pagamento:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Erro desconhecido');
  }
});

/**
 * Criar agendamento com validacao ATOMICA de conflito de horario
 * Usa Firestore Transaction para garantir que NAO ha race condition
 * entre multiplos usuarios tentando reservar o mesmo horario.
 */
export const createAppointmentWithSlotLock = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { appointmentData } = data;
  if (!appointmentData || !appointmentData.date || !appointmentData.time) {
    throw new functions.https.HttpsError('invalid-argument', 'Data e horário são obrigatórios');
  }

  const userId = context.auth.uid;
  const appointmentDate = appointmentData.date;
  const appointmentTime = appointmentData.time;

  try {
    // Funcao que roda dentro da transacao
    const result = await db.runTransaction(async (transaction) => {
      // Buscar TODOS os appointments da data/horario que possam conflitar
      const conflictingQuery = db.collection('appointments')
        .where('date', '==', appointmentDate)
        .where('time', '==', appointmentTime);

      const conflictingSnap = await transaction.get(conflictingQuery);

      // Verificar conflitos
      const now = Date.now();
      const SLOT_HOLD_MS = 10 * 60 * 1000; // 10 minutos

      for (const doc of conflictingSnap.docs) {
        const existing = doc.data();

        // Cancelados/Expirados nao bloqueiam
        if (existing.status === 'Cancelado') continue;
        if (existing.pixStatus === 'expired' || existing.pixStatus === 'cancelled') continue;

        // Se ja foi pago, BLOQUEIA DEFINITIVAMENTE
        if (existing.pixStatus === 'paid') {
          throw new functions.https.HttpsError(
            'already-exists',
            `O horário ${appointmentTime} já está reservado e pago. Escolha outro horário.`
          );
        }

        // Se esta aguardando pagamento, BLOQUEIA ate PIX expirar
        if (existing.status === 'Aguardando Pagamento') {
          const createdAt = existing.createdAt?.toMillis ? existing.createdAt.toMillis() : 0;
          const elapsed = now - createdAt;
          if (elapsed < SLOT_HOLD_MS) {
            throw new functions.https.HttpsError(
              'already-exists',
              `O horário ${appointmentTime} está reservado por outro cliente. Tente novamente em ${Math.ceil((SLOT_HOLD_MS - elapsed) / 60000)} minutos ou escolha outro horário.`
            );
          }
        }

        // Outros status ativos bloqueiam
        if (['Agendado', 'Veículo Recebido', 'Serviço Iniciado'].includes(existing.status)) {
          throw new functions.https.HttpsError(
            'already-exists',
            `O horário ${appointmentTime} já está ocupado. Escolha outro horário.`
          );
        }
      }

      // Se chegou aqui, NAO ha conflito. Criar o appointment.
      const newRef = db.collection('appointments').doc();

      // Garantir userId do contexto (seguranca)
      const safeData = {
        ...appointmentData,
        userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      transaction.set(newRef, safeData);

      return newRef.id;
    });

    console.log(`[createAppointmentWithSlotLock] Agendamento criado: ${result}`);

    return {
      success: true,
      appointmentId: result,
    };
  } catch (error: any) {
    console.error('[createAppointmentWithSlotLock] Erro:', error);

    // Re-throw HttpsError (vai mostrar mensagem amigavel)
    if (error.code && error.code.startsWith('functions/https/')) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Erro ao criar agendamento'
    );
  }
});

/**
 * Buscar agendamento por OS ou ID
 * Usado pelo scanner de QR Code do admin
 */
export const findAppointmentByOS = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { os, appointmentId } = data;

  if (!os && !appointmentId) {
    throw new functions.https.HttpsError('invalid-argument', 'OS ou appointmentId é obrigatório');
  }

  try {
    let docRef: FirebaseFirestore.DocumentReference | null = null;

    if (appointmentId) {
      docRef = db.collection('appointments').doc(appointmentId);
    } else if (os) {
      // Buscar por OS (número de ordem de serviço)
      const snapshot = await db.collection('appointments')
        .where('os', '==', os)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return { success: false, error: 'Agendamento não encontrado' };
      }

      docRef = snapshot.docs[0].ref;
    }

    if (!docRef) {
      throw new functions.https.HttpsError('invalid-argument', 'OS ou appointmentId é obrigatório');
    }

    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: false, error: 'Agendamento não encontrado' };
    }

    const appt = docSnap.data()!;
    return {
      success: true,
      appointment: {
        id: docSnap.id,
        os: appt.os,
        userName: appt.userName || appt.name,
        userCelular: appt.userCelular || appt.celular,
        car: appt.car,
        plate: appt.plate,
        date: appt.date,
        time: appt.time,
        services: appt.services,
        serviceNames: appt.serviceNames,
        totalPrice: appt.totalPrice,
        status: appt.status,
        pixStatus: appt.pixStatus,
        pixAmount: appt.pixAmount,
        createdAt: appt.createdAt?.toDate?.()?.toISOString()
      }
    };

  } catch (error: any) {
    console.error('[findAppointmentByOS] Erro:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Erro ao buscar agendamento');
  }
});

/**
 * Adicionar entrada ao timeline de um agendamento
 */
export const addTimelineEntry = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { appointmentId, status, note } = data;

  if (!appointmentId) {
    throw new functions.https.HttpsError('invalid-argument', 'appointmentId é obrigatório');
  }

  try {
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    const docSnap = await appointmentRef.get();

    if (!docSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Agendamento não encontrado');
    }

    const appt = docSnap.data()!;
    const entry = {
      status: status || appt.status,
      date: new Date().toISOString(),
      note: note || null
    };

    await appointmentRef.update({
      timeline: admin.firestore.FieldValue.arrayUnion(entry)
    });

    return { success: true };

  } catch (error: any) {
    console.error('[addTimelineEntry] Erro:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Erro ao atualizar timeline');
  }
});
