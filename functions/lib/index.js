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
Object.defineProperty(exports, "__esModule", { value: true });
exports.testAsaasConnectionFn = exports.saveTenantConfig = exports.uploadGalleryImage = exports.getTenantConfig = exports.initializeDefaultTenant = exports.addTimelineEntry = exports.findAppointmentByOS = exports.createAppointmentWithSlotLock = exports.simulatePaymentConfirmed = exports.checkExpiredPayments = exports.seedServices = exports.bootstrapAdminHttp = exports.bootstrapAdmin = exports.saveTransaction = exports.cancelPixPayment = exports.asaasWebhook = exports.checkPixPaymentStatus = exports.createPixPaymentForAppointment = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const dotenv = __importStar(require("dotenv"));
const crypto_1 = require("./crypto");
const asaas_1 = require("./asaas");
// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: '.env.local' });
// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();
// ============================================
// BUCKET FIXO (resolve erro "bucket does not exist")
// ============================================
// IMPORTANTE: Admin SDK aceita ambos os formatos (.appspot.com OU .firebasestorage.app)
// mas o mais confiável é .appspot.com (formato legacy)
const STORAGE_BUCKET = process.env.STORAGE_BUCKET
    || 'brilhocar-estetica-9f14b.appspot.com';
function getStorageBucket() {
    const bucket = admin.storage().bucket(STORAGE_BUCKET);
    console.log(`[Storage] Bucket usado: ${bucket.name}`);
    return bucket;
}
// ============================================
// TYPES
// ============================================
// Types Asaas vêm de ./asaas.ts
// ============================================
// FUNÇÕES ASAAS MULTI-TENANT (em ./asaas.ts)
// ============================================
//   - getAsaasConfigForTenant(tenantId)
//   - testAsaasConnection(tenantId)
//   - getOrCreateAsaasCustomer(tenantId, userData)
//   - createPixPaymentMulti(tenantId, customerId, amount, description)
//   - checkPaymentStatusMulti(tenantId, paymentId)
//   - cancelPixPaymentMulti(tenantId, paymentId)
// ============================================
// FUNÇÕES FIREBASE CLOUD
// ============================================
/**
 * Criar pagamento PIX para um agendamento (multi-tenant)
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
    // Determinar tenantId (multi-tenant)
    const tenantId = appointment.tenantId || 'brilhocar';
    try {
        // Criar ou buscar cliente no Asaas (multi-tenant)
        const customerId = await (0, asaas_1.getOrCreateAsaasCustomer)(tenantId, {
            name: appointment.userName || userData.name || 'Cliente',
            celular: appointment.userCelular || userData.celular || '',
            email: userData.email || undefined,
            cpfCnpj: userData.cpfCnpj || undefined
        });
        // Criar pagamento PIX (multi-tenant)
        const description = `Sinal agendamento #${appointment.os || appointmentId}`;
        const pixResult = await (0, asaas_1.createPixPayment)(tenantId, customerId, pixAmount, description);
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
            tenantId
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
        let tenantId = 'brilhocar';
        if (paymentId) {
            // Buscar pelo paymentId (precisa do tenantId do appointment)
            const appointmentsSnap = await db.collection('appointments')
                .where('pixPaymentId', '==', paymentId)
                .limit(1)
                .get();
            if (!appointmentsSnap.empty) {
                tenantId = appointmentsSnap.docs[0].data().tenantId || 'brilhocar';
            }
            status = await (0, asaas_1.checkPaymentStatus)(tenantId, paymentId);
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
            tenantId = appointment.tenantId || 'brilhocar';
            status = await (0, asaas_1.checkPaymentStatus)(tenantId, appointment.pixPaymentId);
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
        // Buscar tenantId do agendamento
        const appointmentsSnapshot = await db.collection('appointments')
            .where('pixPaymentId', '==', paymentId)
            .limit(1)
            .get();
        let tenantId = 'brilhocar';
        let appointmentRef = null;
        if (!appointmentsSnapshot.empty) {
            appointmentRef = appointmentsSnapshot.docs[0].ref;
            tenantId = appointmentsSnapshot.docs[0].data().tenantId || 'brilhocar';
        }
        // Cancelar no Asaas (multi-tenant)
        await (0, asaas_1.cancelPixPayment)(tenantId, paymentId);
        // Atualizar status no Firestore
        if (appointmentRef) {
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
 * Bootstrap Admin HTTP - Endpoint HTTP v1 com CORS manual
 * Alternativa para casos onde httpsCallable tem problemas de CORS
 * Uso: POST /bootstrapAdminHttp com header Authorization: Bearer <firebase-id-token>
 */
const corsHandler = (req, res, next) => {
    // CORS manual - aceita qualquer origem
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    next();
};
exports.bootstrapAdminHttp = functions.https.onRequest((req, res) => {
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
        }
        catch (err) {
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
exports.seedServices = functions.https.onCall(async (_data, context) => {
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
        batch.set(ref, Object.assign(Object.assign({}, service), { createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
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
/**
 * SIMULAR PAGAMENTO - PARA TESTES ONLY
 * Esta função simula o que o webhook do Asaas faz quando recebe PAYMENT_RECEIVED
 * IMPORTANTE: REMOVER EM PRODUÇÃO!
 */
exports.simulatePaymentConfirmed = functions.https.onCall(async (data, context) => {
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
        }
        else {
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
    }
    catch (error) {
        console.error('Erro ao simular pagamento:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Erro desconhecido');
    }
});
/**
 * Criar agendamento com validacao ATOMICA de conflito de horario
 * Usa Firestore Transaction para garantir que NAO ha race condition
 * entre multiplos usuarios tentando reservar o mesmo horario.
 */
exports.createAppointmentWithSlotLock = functions.https.onCall(async (data, context) => {
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
            var _a;
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
                if (existing.status === 'Cancelado')
                    continue;
                if (existing.pixStatus === 'expired' || existing.pixStatus === 'cancelled')
                    continue;
                // Se ja foi pago, BLOQUEIA DEFINITIVAMENTE
                if (existing.pixStatus === 'paid') {
                    throw new functions.https.HttpsError('already-exists', `O horário ${appointmentTime} já está reservado e pago. Escolha outro horário.`);
                }
                // Se esta aguardando pagamento, BLOQUEIA ate PIX expirar
                if (existing.status === 'Aguardando Pagamento') {
                    const createdAt = ((_a = existing.createdAt) === null || _a === void 0 ? void 0 : _a.toMillis) ? existing.createdAt.toMillis() : 0;
                    const elapsed = now - createdAt;
                    if (elapsed < SLOT_HOLD_MS) {
                        throw new functions.https.HttpsError('already-exists', `O horário ${appointmentTime} está reservado por outro cliente. Tente novamente em ${Math.ceil((SLOT_HOLD_MS - elapsed) / 60000)} minutos ou escolha outro horário.`);
                    }
                }
                // Outros status ativos bloqueiam
                if (['Agendado', 'Veículo Recebido', 'Serviço Iniciado'].includes(existing.status)) {
                    throw new functions.https.HttpsError('already-exists', `O horário ${appointmentTime} já está ocupado. Escolha outro horário.`);
                }
            }
            // Se chegou aqui, NAO ha conflito. Criar o appointment.
            const newRef = db.collection('appointments').doc();
            // Garantir userId do contexto (seguranca)
            const safeData = Object.assign(Object.assign({}, appointmentData), { userId, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            transaction.set(newRef, safeData);
            return newRef.id;
        });
        console.log(`[createAppointmentWithSlotLock] Agendamento criado: ${result}`);
        return {
            success: true,
            appointmentId: result,
        };
    }
    catch (error) {
        console.error('[createAppointmentWithSlotLock] Erro:', error);
        // Re-throw HttpsError (vai mostrar mensagem amigavel)
        if (error.code && error.code.startsWith('functions/https/')) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'Erro ao criar agendamento');
    }
});
/**
 * Buscar agendamento por OS ou ID
 * Usado pelo scanner de QR Code do admin
 */
exports.findAppointmentByOS = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const { os, appointmentId } = data;
    if (!os && !appointmentId) {
        throw new functions.https.HttpsError('invalid-argument', 'OS ou appointmentId é obrigatório');
    }
    try {
        let docRef = null;
        if (appointmentId) {
            docRef = db.collection('appointments').doc(appointmentId);
        }
        else if (os) {
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
        const appt = docSnap.data();
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
                createdAt: (_c = (_b = (_a = appt.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString()
            }
        };
    }
    catch (error) {
        console.error('[findAppointmentByOS] Erro:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Erro ao buscar agendamento');
    }
});
/**
 * Adicionar entrada ao timeline de um agendamento
 */
exports.addTimelineEntry = functions.https.onCall(async (data, context) => {
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
        const appt = docSnap.data();
        const entry = {
            status: status || appt.status,
            date: new Date().toISOString(),
            note: note || null
        };
        await appointmentRef.update({
            timeline: admin.firestore.FieldValue.arrayUnion(entry)
        });
        return { success: true };
    }
    catch (error) {
        console.error('[addTimelineEntry] Erro:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Erro ao atualizar timeline');
    }
});
/**
 * Inicializar tenant padrão no Firestore
 * Cria o documento de tenant 'brilhocar' se não existir
 */
exports.initializeDefaultTenant = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    // Verificar se é admin
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas admin pode executar');
    }
    const tenantId = 'brilhocar';
    // Verificar se já existe
    const existing = await db.collection('tenants').doc(tenantId).get();
    if (existing.exists) {
        return {
            success: true,
            message: 'Tenant padrão já existe',
            tenantId
        };
    }
    // Criar tenant padrão
    const defaultTenant = {
        id: tenantId,
        displayName: 'BrilhoCar Estética Automotiva',
        logoText: 'BrilhoCar',
        primaryColor: '#00e676',
        primaryHover: '#00c853',
        accentColor: '#D4AF37',
        backgroundColor: '#0a0a0f',
        surfaceColor: '#151515',
        backgroundColorLight: '#FFFFFF',
        surfaceColorLight: '#F5F5F5',
        themeMode: 'auto',
        logoUrl: '',
        contact: {
            email: 'contato@brilhocar.com',
            phone: '(11) 98131-2143',
            whatsapp: '5511981312143',
            address: 'Mauá, SP',
            instagram: '@brilhocar',
            facebook: 'BrilhoCar',
            city: 'Mauá'
        },
        pix: {
            walletId: '',
            pixKey: '',
            environment: process.env.ASAAS_ENVIRONMENT || 'sandbox'
        },
        firebaseConfig: {
            apiKey: '',
            authDomain: '',
            projectId: 'brilhocar-estetica-9f14b',
            storageBucket: 'brilhocar-estetica-9f14b.firebasestorage.app',
            messagingSenderId: '',
            appId: ''
        },
        status: 'active',
        plan: 'pro',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    // Criptografar Asaas API key se configurada no env
    const asaasKeyFromEnv = process.env.ASAAS_API_KEY;
    if (asaasKeyFromEnv && asaasKeyFromEnv.length > 0) {
        try {
            defaultTenant.pix.AsaasAPIKey = (0, crypto_1.encrypt)(asaasKeyFromEnv, tenantId);
            console.log(`[initializeDefaultTenant] Asaas key criptografada do env`);
        }
        catch (err) {
            console.warn(`[initializeDefaultTenant] Erro ao criptografar Asaas key:`, err.message);
        }
    }
    await db.collection('tenants').doc(tenantId).set(defaultTenant);
    console.log(`[initializeDefaultTenant] Tenant padrão '${tenantId}' criado`);
    return {
        success: true,
        message: 'Tenant padrão criado com sucesso!',
        tenantId
    };
});
/**
 * Buscar configuração de tenant (para clientes)
 */
exports.getTenantConfig = functions.https.onCall(async (data) => {
    const { tenantId } = data;
    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId é obrigatório');
    }
    try {
        const docSnap = await db.collection('tenants').doc(tenantId).get();
        if (!docSnap.exists) {
            return { success: false, error: 'Tenant não encontrado' };
        }
        const tenant = docSnap.data();
        // Não retornar dados sensíveis
        return {
            success: true,
            tenant: {
                id: docSnap.id,
                displayName: tenant === null || tenant === void 0 ? void 0 : tenant.displayName,
                logoText: tenant === null || tenant === void 0 ? void 0 : tenant.logoText,
                primaryColor: tenant === null || tenant === void 0 ? void 0 : tenant.primaryColor,
                accentColor: tenant === null || tenant === void 0 ? void 0 : tenant.accentColor,
                contact: tenant === null || tenant === void 0 ? void 0 : tenant.contact,
                status: tenant === null || tenant === void 0 ? void 0 : tenant.status
            }
        };
    }
    catch (error) {
        console.error('[getTenantConfig] Erro:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Erro ao buscar tenant');
    }
});
/**
 * Upload de imagem para a galeria (resolve problema de CORS)
 * Recebe base64 da imagem e salva no Storage com permissão pública
 */
exports.uploadGalleryImage = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas admin pode fazer upload');
    }
    const { imageData, fileName } = data;
    if (!imageData || !fileName) {
        throw new functions.https.HttpsError('invalid-argument', 'imageData e fileName são obrigatórios');
    }
    try {
        const bucket = getStorageBucket();
        const timestamp = Date.now();
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `gallery/${timestamp}-${safeName}`;
        const file = bucket.file(filePath);
        // Converter base64 para buffer
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        // Upload
        await file.save(buffer, {
            metadata: {
                contentType: 'image/jpeg',
                metadata: {
                    uploadedBy: context.auth.uid,
                    uploadedAt: new Date().toISOString(),
                }
            },
            resumable: false,
        });
        // Tornar público
        await file.makePublic();
        // Obter URL pública
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        console.log(`[uploadGalleryImage] Upload concluído: ${publicUrl}`);
        return {
            success: true,
            url: publicUrl,
            filePath,
        };
    }
    catch (error) {
        console.error('[uploadGalleryImage] Erro:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Erro ao fazer upload');
    }
});
// ============================================
// FUNÇÕES DE SEGURANÇA E MULTI-TENANT
// ============================================
/**
 * Salvar configuração do tenant com criptografia automática de campos sensíveis
 * Campos criptografados: asaas.AsaasAPIKey, firebase.apiKey
 */
exports.saveTenantConfig = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    // Verificar se é admin
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas admin');
    }
    const { tenantId, config } = data;
    if (!tenantId || !config) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId e config obrigatórios');
    }
    try {
        // Criptografar campos sensíveis
        const encryptedConfig = JSON.parse(JSON.stringify(config));
        if (((_a = encryptedConfig.asaas) === null || _a === void 0 ? void 0 : _a.AsaasAPIKey) && encryptedConfig.asaas.AsaasAPIKey.length > 0) {
            // Não criptografar se já estiver criptografado (idempotência)
            if (!isAlreadyEncrypted(encryptedConfig.asaas.AsaasAPIKey)) {
                encryptedConfig.asaas.AsaasAPIKey = (0, crypto_1.encrypt)(encryptedConfig.asaas.AsaasAPIKey, tenantId);
                console.log(`[saveTenantConfig] API key Asaas criptografada para tenant ${tenantId}`);
            }
        }
        // Limpar plaintext legado se existir
        if (encryptedConfig.asaas) {
            delete encryptedConfig.asaas.apiKey;
            delete encryptedConfig.asaas.apiKeyPlaintext;
        }
        // Salvar no Firestore
        await db.collection('tenants').doc(tenantId).set(encryptedConfig, { merge: true });
        console.log(`[saveTenantConfig] Tenant ${tenantId} atualizado`);
        // Retornar config sem expor secrets
        return {
            success: true,
            config: removeSecrets(encryptedConfig),
        };
    }
    catch (err) {
        console.error('[saveTenantConfig] Erro:', err);
        throw new functions.https.HttpsError('internal', err.message || 'Erro ao salvar');
    }
});
/**
 * Testar conexão Asaas para o tenant atual (sem expor a key)
 */
exports.testAsaasConnectionFn = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas admin');
    }
    const tenantId = (data === null || data === void 0 ? void 0 : data.tenantId) || 'brilhocar';
    try {
        const result = await (0, asaas_1.testAsaasConnection)(tenantId);
        return result;
    }
    catch (err) {
        console.error('[testAsaasConnection] Erro:', err);
        throw new functions.https.HttpsError('internal', err.message || 'Erro ao testar conexão');
    }
});
// ============================================
// HELPERS LOCAIS
// ============================================
/**
 * Detecta se uma string já está criptografada (heurística simples)
 */
function isAlreadyEncrypted(value) {
    if (!value)
        return false;
    // String criptografada é base64 com tamanho mínimo ~40 chars
    if (value.length < 40)
        return false;
    // Verifica se parece base64 válido
    return /^[A-Za-z0-9+/=]+$/.test(value);
}
/**
 * Remove campos sensíveis do objeto antes de retornar para o frontend
 */
function removeSecrets(config) {
    var _a;
    const cleaned = JSON.parse(JSON.stringify(config));
    if (cleaned.asaas) {
        delete cleaned.asaas.AsaasAPIKey;
        delete cleaned.asaas.apiKey;
        delete cleaned.asaas.apiKeyPlaintext;
    }
    if ((_a = cleaned.firebase) === null || _a === void 0 ? void 0 : _a.apiKey) {
        delete cleaned.firebase.apiKey;
    }
    return cleaned;
}
//# sourceMappingURL=index.js.map