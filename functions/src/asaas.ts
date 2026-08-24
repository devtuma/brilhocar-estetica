/**
 * Módulo Asaas Multi-Tenant
 *
 * Cada tenant tem suas próprias credenciais Asaas criptografadas no Firestore.
 * As credenciais são descriptografadas em runtime usando MASTER_KEY.
 */

import * as admin from 'firebase-admin';
import axios from 'axios';
import { decryptIfEncrypted } from './crypto';

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpfCnpj: string | null;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  netValue: number;
  status: string;
  dueDate: string;
  paymentDate: string | null;
  pixQrCode: string | null;
  pixQrCodeUrl: string | null;
  invoiceUrl: string | null;
}

export interface AsaasConfig {
  baseURL: string;
  apiKey: string;
  pixKey?: string;
  environment: 'production' | 'sandbox';
}

export interface TenantAsaasConfig {
  tenantId: string;
  asaas: {
    AsaasAPIKey?: string;       // Criptografada
    apiKeyPlaintext?: string;   // LEGADO: plaintext (será migrado)
    walletId?: string;
    pixKey?: string;
    environment?: 'production' | 'sandbox';
  };
}

/**
 * Busca e descriptografa a configuração Asaas de um tenant
 */
export async function getAsaasConfigForTenant(tenantId: string): Promise<AsaasConfig> {
  const tenantDoc = await admin.firestore()
    .collection('tenants')
    .doc(tenantId)
    .get();

  if (!tenantDoc.exists) {
    throw new Error(`[Asaas] Tenant '${tenantId}' não encontrado`);
  }

  const tenantData = tenantDoc.data();
  const asaasData = tenantData?.asaas || {};

  // Tentar descriptografar a chave
  let apiKey = '';

  if (asaasData.AsaasAPIKey) {
    // Nova versão: criptografada
    apiKey = decryptIfEncrypted(asaasData.AsaasAPIKey, tenantId);
  } else if (asaasData.apiKey) {
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
export function getAsaasHeaders(apiKey: string) {
  return {
    'access_token': apiKey,
    'Content-Type': 'application/json',
  };
}

/**
 * Testa conexão com Asaas para um tenant específico
 */
export async function testAsaasConnection(tenantId: string): Promise<{
  success: boolean;
  account?: any;
  error?: string;
  environment?: string;
}> {
  try {
    const config = await getAsaasConfigForTenant(tenantId);

    // Tentar buscar dados da conta (endpoint /myAccount é público para a própria conta)
    const response = await axios.get(`${config.baseURL}/myAccount`, {
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
  } catch (err: any) {
    const status = err?.response?.status;
    const errorBody = err?.response?.data;

    return {
      success: false,
      error: status === 401
        ? 'API Key inválida ou expirada'
        : errorBody?.errors?.[0]?.description || err.message || 'Erro desconhecido',
    };
  }
}

/**
 * Criar ou buscar cliente no Asaas para um tenant
 */
export async function getOrCreateAsaasCustomer(
  tenantId: string,
  userData: { name: string; celular: string; email?: string; cpfCnpj?: string }
): Promise<string> {
  const config = await getAsaasConfigForTenant(tenantId);
  const celularLimpo = userData.celular.replace(/\D/g, '');

  const cpfCnpj = userData.cpfCnpj || gerarCpfFromCelular(celularLimpo);

  try {
    // Buscar cliente existente pelo CPF
    const response = await axios.get(`${config.baseURL}/customers`, {
      headers: getAsaasHeaders(config.apiKey),
      params: { cpfCnpj },
    });

    if (response.data.data && response.data.data.length > 0) {
      console.log(`[Asaas:${tenantId}] Cliente encontrado: ${response.data.data[0].id}`);
      return response.data.data[0].id;
    }
  } catch (error: any) {
    console.log(`[Asaas:${tenantId}] Busca falhou (normal), criando novo...`);
  }

  // Criar novo cliente
  const customerData: any = {
    name: userData.name,
    phone: celularLimpo,
    cpfCnpj,
    externalReference: `tenant:${tenantId}:celular:${celularLimpo}`,
    notificationDisabled: false,
  };

  customerData.email = userData.email || `${celularLimpo}@${tenantId}.com.br`;

  try {
    const response = await axios.post(`${config.baseURL}/customers`, customerData, {
      headers: getAsaasHeaders(config.apiKey),
    });

    console.log(`[Asaas:${tenantId}] Cliente criado: ${response.data.id}`);
    return response.data.id;
  } catch (error: any) {
    const status = error?.response?.status;
    const errorBody = error?.response?.data;
    throw new Error(
      `Falha ao criar cliente Asaas (${status}): ${JSON.stringify(
        errorBody?.errors?.[0]?.description || errorBody || error?.message
      )}`
    );
  }
}

/**
 * Criar pagamento PIX
 */
export async function createPixPayment(
  tenantId: string,
  customerId: string,
  amount: number,
  description: string
): Promise<{ paymentId: string; qrCode: string; payload: string; expiresAt: string }> {
  const config = await getAsaasConfigForTenant(tenantId);

  const PIX_EXPIRATION_MINUTES = 10;
  const expiresAt = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000);
  const dueDate = expiresAt.toISOString().split('T')[0];

  const paymentData: any = {
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

  const paymentResponse = await axios.post(`${config.baseURL}/payments`, paymentData, {
    headers: getAsaasHeaders(config.apiKey),
  });

  const payment = paymentResponse.data;

  const qrResponse = await axios.get(`${config.baseURL}/payments/${payment.id}/pixQrCode`, {
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
export async function checkPaymentStatus(
  tenantId: string,
  paymentId: string
): Promise<string> {
  const config = await getAsaasConfigForTenant(tenantId);

  const response = await axios.get(`${config.baseURL}/payments/${paymentId}`, {
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
export async function cancelPixPayment(
  tenantId: string,
  paymentId: string
): Promise<void> {
  const config = await getAsaasConfigForTenant(tenantId);

  await axios.delete(`${config.baseURL}/payments/${paymentId}`, {
    headers: getAsaasHeaders(config.apiKey),
  });

  console.log(`[Asaas:${tenantId}] Pagamento ${paymentId} cancelado`);
}

// ============================================
// HELPERS
// ============================================

function calcularDigitosCpf(base: number[]): [number, number] {
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

function gerarCpfFromCelular(celular: string): string {
  const celularDigits = celular.replace(/\D/g, '').split('').map(Number);

  const baseDigits: number[] = [];
  const startIdx = Math.max(0, celularDigits.length - 9);
  for (let i = 0; i < 9; i++) {
    baseDigits.push(celularDigits[startIdx + i] ?? (i + 1));
  }

  const [dig1, dig2] = calcularDigitosCpf(baseDigits);
  return [...baseDigits, dig1, dig2].join('');
}
