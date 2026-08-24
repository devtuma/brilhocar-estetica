"use strict";
/**
 * Módulo Asaas Multi-Tenant
 *
 * Cada tenant tem suas próprias credenciais Asaas criptografadas no Firestore.
 * As credenciais são descriptografadas em runtime usando MASTER_KEY.
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAsaasConfigForTenant = getAsaasConfigForTenant;
exports.getAsaasHeaders = getAsaasHeaders;
exports.testAsaasConnection = testAsaasConnection;
exports.getOrCreateAsaasCustomer = getOrCreateAsaasCustomer;
exports.createPixPayment = createPixPayment;
exports.checkPaymentStatus = checkPaymentStatus;
exports.cancelPixPayment = cancelPixPayment;
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("./crypto");
/**
 * Busca e descriptografa a configuração Asaas de um tenant
 */
async function getAsaasConfigForTenant(tenantId) {
    const tenantDoc = await admin.firestore()
        .collection('tenants')
        .doc(tenantId)
        .get();
    if (!tenantDoc.exists) {
        throw new Error(`[Asaas] Tenant '${tenantId}' não encontrado`);
    }
    const tenantData = tenantDoc.data();
    const asaasData = (tenantData === null || tenantData === void 0 ? void 0 : tenantData.asaas) || {};
    // Tentar descriptografar a chave
    let apiKey = '';
    if (asaasData.AsaasAPIKey) {
        // Nova versão: criptografada
        apiKey = (0, crypto_1.decryptIfEncrypted)(asaasData.AsaasAPIKey, tenantId);
    }
    else if (asaasData.apiKey) {
        // Legado: plaintext
        apiKey = asaasData.apiKey;
    }
    if (!apiKey) {
        throw new Error(`[Asaas] API key não configurada para tenant '${tenantId}'`);
    }
    const environment = asaasData.environment || 'production';
    const baseURL = environment === 'production'
        ? 'https://api.asaas.com/v3'
        : 'https://sandbox.asaas.com/api/v3';
    return {
        baseURL,
        apiKey,
        pixKey: asaasData.pixKey,
        environment,
    };
}
/**
 * Headers de autenticação Asaas
 */
function getAsaasHeaders(apiKey) {
    return {
        'access_token': apiKey,
        'Content-Type': 'application/json',
    };
}
/**
 * Testa conexão com Asaas para um tenant específico
 */
async function testAsaasConnection(tenantId) {
    var _a, _b, _c, _d;
    try {
        const config = await getAsaasConfigForTenant(tenantId);
        // Tentar buscar dados da conta (endpoint /myAccount é público para a própria conta)
        const response = await axios_1.default.get(`${config.baseURL}/myAccount`, {
            headers: getAsaasHeaders(config.apiKey),
        });
        return {
            success: true,
            account: {
                name: response.data.name,
                email: response.data.email,
                companyName: response.data.companyName || null,
                walletId: response.data.walletId,
            },
            environment: config.environment,
        };
    }
    catch (err) {
        const status = (_a = err === null || err === void 0 ? void 0 : err.response) === null || _a === void 0 ? void 0 : _a.status;
        const errorBody = (_b = err === null || err === void 0 ? void 0 : err.response) === null || _b === void 0 ? void 0 : _b.data;
        return {
            success: false,
            error: status === 401
                ? 'API Key inválida ou expirada'
                : ((_d = (_c = errorBody === null || errorBody === void 0 ? void 0 : errorBody.errors) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.description) || err.message || 'Erro desconhecido',
        };
    }
}
/**
 * Criar ou buscar cliente no Asaas para um tenant
 */
async function getOrCreateAsaasCustomer(tenantId, userData) {
    var _a, _b, _c, _d;
    const config = await getAsaasConfigForTenant(tenantId);
    const celularLimpo = userData.celular.replace(/\D/g, '');
    const cpfCnpj = userData.cpfCnpj || gerarCpfFromCelular(celularLimpo);
    try {
        // Buscar cliente existente pelo CPF
        const response = await axios_1.default.get(`${config.baseURL}/customers`, {
            headers: getAsaasHeaders(config.apiKey),
            params: { cpfCnpj },
        });
        if (response.data.data && response.data.data.length > 0) {
            console.log(`[Asaas:${tenantId}] Cliente encontrado: ${response.data.data[0].id}`);
            return response.data.data[0].id;
        }
    }
    catch (error) {
        console.log(`[Asaas:${tenantId}] Busca falhou (normal), criando novo...`);
    }
    // Criar novo cliente
    const customerData = {
        name: userData.name,
        phone: celularLimpo,
        cpfCnpj,
        externalReference: `tenant:${tenantId}:celular:${celularLimpo}`,
        notificationDisabled: false,
    };
    customerData.email = userData.email || `${celularLimpo}@${tenantId}.com.br`;
    try {
        const response = await axios_1.default.post(`${config.baseURL}/customers`, customerData, {
            headers: getAsaasHeaders(config.apiKey),
        });
        console.log(`[Asaas:${tenantId}] Cliente criado: ${response.data.id}`);
        return response.data.id;
    }
    catch (error) {
        const status = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status;
        const errorBody = (_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.data;
        throw new Error(`Falha ao criar cliente Asaas (${status}): ${JSON.stringify(((_d = (_c = errorBody === null || errorBody === void 0 ? void 0 : errorBody.errors) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.description) || errorBody || (error === null || error === void 0 ? void 0 : error.message))}`);
    }
}
/**
 * Criar pagamento PIX
 */
async function createPixPayment(tenantId, customerId, amount, description) {
    const config = await getAsaasConfigForTenant(tenantId);
    const PIX_EXPIRATION_MINUTES = 10;
    const expiresAt = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000);
    const dueDate = expiresAt.toISOString().split('T')[0];
    const paymentData = {
        customer: customerId,
        billingType: 'PIX',
        value: amount,
        dueDate,
        description,
    };
    if (config.pixKey && config.pixKey.trim().length > 0) {
        paymentData.pix = { addressKey: config.pixKey.trim() };
    }
    console.log(`[Asaas:${tenantId}] Criando PIX: amount=${amount}`);
    const paymentResponse = await axios_1.default.post(`${config.baseURL}/payments`, paymentData, {
        headers: getAsaasHeaders(config.apiKey),
    });
    const payment = paymentResponse.data;
    const qrResponse = await axios_1.default.get(`${config.baseURL}/payments/${payment.id}/pixQrCode`, {
        headers: getAsaasHeaders(config.apiKey),
    });
    return {
        paymentId: payment.id,
        qrCode: qrResponse.data.encodedImage || '',
        payload: qrResponse.data.payload || '',
        expiresAt: expiresAt.toISOString(),
    };
}
/**
 * Verificar status do pagamento
 */
async function checkPaymentStatus(tenantId, paymentId) {
    const config = await getAsaasConfigForTenant(tenantId);
    const response = await axios_1.default.get(`${config.baseURL}/payments/${paymentId}`, {
        headers: getAsaasHeaders(config.apiKey),
    });
    const payment = response.data;
    switch (payment.status) {
        case 'RECEIVED':
        case 'CONFIRMED':
            return 'paid';
        case 'PENDING':
            return 'pending';
        case 'OVERDUE':
            return 'overdue';
        case 'CANCELLED':
            return 'cancelled';
        default:
            return payment.status.toLowerCase();
    }
}
/**
 * Cancelar pagamento PIX
 */
async function cancelPixPayment(tenantId, paymentId) {
    const config = await getAsaasConfigForTenant(tenantId);
    await axios_1.default.delete(`${config.baseURL}/payments/${paymentId}`, {
        headers: getAsaasHeaders(config.apiKey),
    });
    console.log(`[Asaas:${tenantId}] Pagamento ${paymentId} cancelado`);
}
// ============================================
// HELPERS
// ============================================
function calcularDigitosCpf(base) {
    let soma1 = 0;
    for (let i = 0; i < 9; i++) {
        soma1 += base[i] * (10 - i);
    }
    let resto1 = soma1 % 11;
    const dig1 = resto1 < 2 ? 0 : 11 - resto1;
    const base2 = [...base, dig1];
    let soma2 = 0;
    for (let i = 0; i < 10; i++) {
        soma2 += base2[i] * (11 - i);
    }
    let resto2 = soma2 % 11;
    const dig2 = resto2 < 2 ? 0 : 11 - resto2;
    return [dig1, dig2];
}
function gerarCpfFromCelular(celular) {
    var _a;
    const celularDigits = celular.replace(/\D/g, '').split('').map(Number);
    const baseDigits = [];
    const startIdx = Math.max(0, celularDigits.length - 9);
    for (let i = 0; i < 9; i++) {
        baseDigits.push((_a = celularDigits[startIdx + i]) !== null && _a !== void 0 ? _a : (i + 1));
    }
    const [dig1, dig2] = calcularDigitosCpf(baseDigits);
    return [...baseDigits, dig1, dig2].join('');
}
//# sourceMappingURL=asaas.js.map