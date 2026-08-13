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
exports.checkExpiredPayments = exports.bootstrapAdminHttp = exports.bootstrapAdmin = exports.saveTransaction = exports.cancelPixPayment = exports.asaasWebhook = exports.checkPixPaymentStatus = exports.createPixPaymentForAppointment = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
const https_1 = require("firebase-functions/v2/https");
// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: '.env.local' });
// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();
// ============================================
// CONFIGURAÇÕES ASAAS
// ============================================
const ASAAS_BASE_URL = ((_a = functions.config().asaas) === null || _a === void 0 ? void 0 : _a.environment) === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
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
    // IMPORTANTE: Asaas sandbox EXIGE CPF/CNPJ para criar pagamentos PIX
    // CPFs de teste válidos para Asaas sandbox: 12345678909, 11144477735, etc.
    // Se não informar, geramos a partir do celular (fixo, determinístico)
    const cpfCnpj = userData.cpfCnpj || gerarCpfFromCelular(celularLimpo);
    try {
        // Buscar cliente existente pelo CPF (mais confiável)
        const response = await axios_1.default.get(`${ASAAS_BASE_URL}/customers`, {
            headers: asaasHeaders,
            params: { cpfCnpj }
        });
        if (response.data.data && response.data.data.length > 0) {
            console.log(`Cliente Asaas encontrado: ${response.data.data[0].id}`);
            return response.data.data[0].id;
        }
    }
    catch (error) {
        console.log('Busca de cliente falhou (normal se não existe), criando novo...', error === null || error === void 0 ? void 0 : error.message);
    }
    // Criar novo cliente
    // IMPORTANTE: Asaas EXIGE CPF/CNPJ para criar pagamento PIX
    const customerData = {
        name: userData.name,
        phone: celularLimpo,
        cpfCnpj: cpfCnpj,
        externalReference: `celular:${celularLimpo}`,
        notificationDisabled: false,
    };
    if (userData.email) {
        customerData.email = userData.email;
    }
    else {
        customerData.email = `${celularLimpo}@brilhocar.com.br`;
    }
    try {
        const response = await axios_1.default.post(`${ASAAS_BASE_URL}/customers`, customerData, {
            headers: asaasHeaders
        });
        console.log(`Cliente Asaas criado: ${response.data.id} (cpf=${cpfCnpj})`);
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
 * Calcula os dígitos verificadores de um CPF (para gerar CPFs válidos)
 */
function calcularDigitosCpf(base) {
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
function gerarCpfFromCelular(celular) {
    var _a;
    // Pega os primeiros 9 dígitos do celular (ou usa seed se celular curto)
    const celularDigits = celular.replace(/\D/g, '').split('').map(Number);
    // Usa os últimos 9 dígitos do celular (ou padding se necessário)
    const baseDigits = [];
    const startIdx = Math.max(0, celularDigits.length - 9);
    for (let i = 0; i < 9; i++) {
        baseDigits.push((_a = celularDigits[startIdx + i]) !== null && _a !== void 0 ? _a : (i + 1));
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
async function createPixPayment(customerId, amount, description, pixKey) {
    // Calcular data de expiração (10 minutos)
    // Após 10min sem pagamento, o slot é liberado para outra pessoa agendar
    const PIX_EXPIRATION_MINUTES = 10;
    const expiresAt = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000);
    const dueDate = expiresAt.toISOString().split('T')[0];
    // Criar pagamento PIX
    // Se pixKey foi passada, usar como chave específica (precisa estar cadastrada na conta Asaas)
    const paymentData = {
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
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
    }
    catch (error) {
        console.error('Erro ao criar pagamento PIX:', {
            message: error === null || error === void 0 ? void 0 : error.message,
            status: (_d = error === null || error === void 0 ? void 0 : error.response) === null || _d === void 0 ? void 0 : _d.status,
            data: (_e = error === null || error === void 0 ? void 0 : error.response) === null || _e === void 0 ? void 0 : _e.data,
            errors: (_g = (_f = error === null || error === void 0 ? void 0 : error.response) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g.errors,
            ASAAS_API_KEY_LENGTH: ASAAS_API_KEY.length
        });
        // Extrair mensagem de erro detalhada do Asaas
        const asaasErrors = (_j = (_h = error === null || error === void 0 ? void 0 : error.response) === null || _h === void 0 ? void 0 : _h.data) === null || _j === void 0 ? void 0 : _j.errors;
        let errorMessage = 'Erro desconhecido';
        if (asaasErrors && Array.isArray(asaasErrors) && asaasErrors.length > 0) {
            errorMessage = asaasErrors.map(e => e.description || e.message || JSON.stringify(e)).join('; ');
        }
        else if ((_l = (_k = error === null || error === void 0 ? void 0 : error.response) === null || _k === void 0 ? void 0 : _k.data) === null || _l === void 0 ? void 0 : _l.description) {
            errorMessage = error.response.data.description;
        }
        else if ((_o = (_m = error === null || error === void 0 ? void 0 : error.response) === null || _m === void 0 ? void 0 : _m.data) === null || _o === void 0 ? void 0 : _o.message) {
            errorMessage = error.response.data.message;
        }
        else {
            errorMessage = (error === null || error === void 0 ? void 0 : error.message) || 'Erro desconhecido';
        }
        throw new functions.https.HttpsError('internal', `Erro ao criar pagamento: ${errorMessage}`);
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
    var _a;
    // Apenas aceitar POST
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    // SEGURANÇA: Validar token de acesso do Asaas
    // Documentação: https://docs.asaas.com/docs/webhooks-3
    // Configurar token no painel Asaas > Integrations > Webhooks
    const asaasAccessToken = req.headers['asaas-access-token'];
    const expectedToken = ((_a = functions.config().asaas) === null || _a === void 0 ? void 0 : _a.webhook_token) || process.env.ASAAS_WEBHOOK_TOKEN;
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
exports.bootstrapAdmin = functions.https.onCall(async (_data, context) => {
    var _a;
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
    const allowedEmails = (((_a = functions.config().admin) === null || _a === void 0 ? void 0 : _a.emails) || process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);
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
 * Bootstrap Admin HTTP - Endpoint HTTP com CORS habilitado
 * Alternativa para casos onde httpsCallable tem problemas de CORS
 * Uso: POST /bootstrapAdminHttp com header Authorization: Bearer <firebase-id-token>
 *       Body: {} (vazio)
 */
exports.bootstrapAdminHttp = (0, https_1.onRequest)({ cors: true, region: 'us-central1' }, async (req, res) => {
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
    }
    catch (err) {
        console.error('[bootstrapAdminHttp] Erro:', err);
        res.status(500).json({
            success: false,
            error: err.message || 'Erro ao processar'
        });
    }
});
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