"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExpiredPayments = exports.saveTransaction = exports.cancelPixPayment = exports.asaasWebhook = exports.checkPixPaymentStatus = exports.createPixPaymentForAppointment = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: '.env.local' });
// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();
// ============================================
// CONFIGURAÇÕES ASAAS
// ============================================
const ASAAS_BASE_URL = ((_a = functions.config().asaas) === null || _a === void 0 ? void 0 : _a.environment) === 'sandbox'
    ? 'https://api-sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';
const ASAAS_API_KEY = ((_b = functions.config().asaas) === null || _b === void 0 ? void 0 : _b.api_key) || process.env.ASAAS_API_KEY || '';
// Log para debug (apenas primeiros 10 chars) - ajuda a diagnosticar problemas de config
console.log(`[Asaas] URL: ${ASAAS_BASE_URL}`);
console.log(`[Asaas] API Key presente: ${ASAAS_API_KEY ? 'SIM (length=' + ASAAS_API_KEY.length + ')' : 'NÃO - VAZIO!'}`);
// Headers para API Asaas
const asaasHeaders = {
    'access_token': ASAAS_API_KEY,
    'Content-Type': 'application/json'
};
// ============================================
// FUNÇÕES ASAAS
// ============================================
/**
 * Criar ou buscar cliente no Asaas
 */
async function getOrCreateAsaasCustomer(userData) {
    var _a, _b, _c, _d;
    const celularLimpo = userData.celular.replace(/\D/g, '');
    try {
        // Buscar cliente existente pelo email (se tiver) ou externalReference
        // O Asaas permite buscar por vários campos
        const searchParams = {};
        if (userData.email) {
            searchParams.email = userData.email;
        }
        if (Object.keys(searchParams).length > 0) {
            const response = await axios_1.default.get(`${ASAAS_BASE_URL}/customers`, {
                headers: asaasHeaders,
                params: searchParams
            });
            if (response.data.data && response.data.data.length > 0) {
                console.log(`Cliente Asaas encontrado: ${response.data.data[0].id}`);
                return response.data.data[0].id;
            }
        }
    }
    catch (error) {
        console.log('Busca de cliente falhou (normal se não existe), criando novo...', error === null || error === void 0 ? void 0 : error.message);
    }
    // Criar novo cliente
    // IMPORTANTE: Asaas exige o campo 'cpfCnpj' OU pelo menos name+phone+email
    const customerData = {
        name: userData.name,
        phone: celularLimpo,
        externalReference: `celular:${celularLimpo}`, // permite identificar depois
        notificationDisabled: false,
    };
    if (userData.email) {
        customerData.email = userData.email;
    }
    // Sem email: usa como identificador interno
    if (!userData.email) {
        customerData.email = `${celularLimpo}@brilhocar.com.br`;
    }
    try {
        const response = await axios_1.default.post(`${ASAAS_BASE_URL}/customers`, customerData, {
            headers: asaasHeaders
        });
        console.log(`Cliente Asaas criado: ${response.data.id}`);
        return response.data.id;
    }
    catch (error) {
        const status = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status;
        const errorBody = (_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.data;
        console.error('Erro ao criar cliente Asaas:', {
            status,
            body: errorBody,
            message: error === null || error === void 0 ? void 0 : error.message,
            sentData: customerData
        });
        throw new Error(`Falha ao criar cliente no Asaas (${status}): ${JSON.stringify(((_d = (_c = errorBody === null || errorBody === void 0 ? void 0 : errorBody.errors) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.description) || errorBody || (error === null || error === void 0 ? void 0 : error.message))}`);
    }
}
/**
 * Criar pagamento PIX
 */
async function createPixPayment(customerId, amount, description) {
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
    const paymentResponse = await axios_1.default.post(`${ASAAS_BASE_URL}/payments`, paymentData, {
        headers: asaasHeaders
    });
    const payment = paymentResponse.data;
    console.log(`PIX criado: ${payment.id}, status=${payment.status}`);
    // Obter QR Code PIX
    const qrResponse = await axios_1.default.get(`${ASAAS_BASE_URL}/payments/${payment.id}/pixQrCode`, {
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
async function checkPaymentStatus(paymentId) {
    const response = await axios_1.default.get(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
        headers: asaasHeaders
    });
    const payment = response.data;
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
exports.createPixPaymentForAppointment = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
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
    const appointment = appointmentDoc.data();
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
            expiresAt: ((_c = (_b = (_a = appointment.pixExpiresAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString()) || null,
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
    }
    catch (error) {
        console.error('Erro ao criar pagamento PIX:', error);
        throw new functions.https.HttpsError('internal', `Erro ao criar pagamento: ${error.message || 'Erro desconhecido'}`);
    }
});
/**
 * Verificar status do pagamento PIX
 */
exports.checkPixPaymentStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const { paymentId, appointmentId } = data;
    try {
        let status;
        if (paymentId) {
            // Buscar pelo paymentId
            status = await checkPaymentStatus(paymentId);
        }
        else if (appointmentId) {
            // Buscar pelo appointmentId
            const appointmentRef = db.collection('appointments').doc(appointmentId);
            const appointmentDoc = await appointmentRef.get();
            if (!appointmentDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Agendamento não encontrado');
            }
            const appointment = appointmentDoc.data();
            if (appointment.userId !== context.auth.uid) {
                throw new functions.https.HttpsError('permission-denied', 'Sem permissão');
            }
            if (!appointment.pixPaymentId) {
                return { status: 'no_payment' };
            }
            status = await checkPaymentStatus(appointment.pixPaymentId);
        }
        else {
            throw new functions.https.HttpsError('invalid-argument', 'paymentId ou appointmentId é obrigatório');
        }
        return { status };
    }
    catch (error) {
        console.error('Erro ao verificar status:', error);
        throw new functions.https.HttpsError('internal', `Erro ao verificar status: ${error.message || 'Erro desconhecido'}`);
    }
});
/**
 * Webhook do Asaas para receber notificações de pagamento
 */
exports.asaasWebhook = functions.https.onRequest(async (req, res) => {
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
    }
    catch (error) {
        console.error('Erro no webhook:', error);
        res.status(500).send('Internal error');
    }
});
/**
 * Cancelar pagamento PIX pendente
 */
exports.cancelPixPayment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const { paymentId } = data;
    if (!paymentId) {
        throw new functions.https.HttpsError('invalid-argument', 'paymentId é obrigatório');
    }
    try {
        // Cancelar no Asaas
        await axios_1.default.post(`${ASAAS_BASE_URL}/payments/${paymentId}/cancel`, {}, {
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
    }
    catch (error) {
        console.error('Erro ao cancelar pagamento:', error);
        throw new functions.https.HttpsError('internal', `Erro ao cancelar: ${error.message || 'Erro desconhecido'}`);
    }
});
/**
 * Criar transação no histórico (salva localmente)
 */
exports.saveTransaction = functions.https.onCall(async (data, context) => {
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
    const appointment = appointmentDoc.data();
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
exports.checkExpiredPayments = functions.pubsub
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
//# sourceMappingURL=index.js.map