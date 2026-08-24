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
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.isEncrypted = isEncrypted;
exports.decryptIfEncrypted = decryptIfEncrypted;
const crypto = __importStar(require("crypto"));
/**
 * Módulo de criptografia AES-256-GCM para proteger secrets (API keys, etc.)
 *
 * Padrão de uso:
 *   - MASTER_KEY salva em process.env.MASTER_KEY (configurada via firebase functions:config)
 *   - Salt por tenant gerado e salvo no Firestore
 *   - Cada secret criptografado inclui IV + authTag + ciphertext
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, recomendado para GCM
const KEY_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16;
function getMasterKey() {
    const masterKey = process.env.MASTER_KEY;
    if (!masterKey) {
        throw new Error('[crypto] MASTER_KEY não configurada. Execute: firebase functions:config:set crypto.master_key="..."');
    }
    // Converter hex string para buffer, ou fazer hash SHA-256 de string normal
    if (masterKey.length === 64) {
        // Já é hex de 64 chars (32 bytes)
        return Buffer.from(masterKey, 'hex');
    }
    // Derivar chave de 32 bytes a partir da string mestra
    return crypto.createHash('sha256').update(masterKey).digest();
}
/**
 * Deriva uma chave específica por tenant usando HKDF
 * Cada tenant tem sua própria chave derivada para isolar comprometimentos
 */
function deriveTenantKey(tenantId) {
    const masterKey = getMasterKey();
    const salt = Buffer.from(`brilhocar-tenant-${tenantId}`, 'utf8');
    // HKDF para derivar chave (retorna ArrayBuffer)
    const derivedKey = crypto.hkdfSync('sha256', masterKey, salt, Buffer.alloc(0), KEY_LENGTH);
    // Converter para Buffer (hkdfSync retorna ArrayBufferLike)
    return Buffer.from(derivedKey);
}
/**
 * Criptografa um texto usando AES-256-GCM com chave derivada do tenant
 *
 * @param plaintext Texto a criptografar (ex: API key do Asaas)
 * @param tenantId ID do tenant (usado para derivar chave)
 * @returns String base64 contendo: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
 */
function encrypt(plaintext, tenantId) {
    if (!plaintext)
        return '';
    const key = deriveTenantKey(tenantId);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    // Concatenar: IV + AuthTag + Ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
}
/**
 * Descriptografa um texto criptografado com encrypt()
 *
 * @param ciphertextBase64 String base64 do encrypt()
 * @param tenantId ID do tenant (mesmo usado no encrypt)
 * @returns Texto em plaintext
 */
function decrypt(ciphertextBase64, tenantId) {
    if (!ciphertextBase64)
        return '';
    try {
        const key = deriveTenantKey(tenantId);
        const combined = Buffer.from(ciphertextBase64, 'base64');
        // Extrair IV, AuthTag e Ciphertext
        const iv = combined.subarray(0, IV_LENGTH);
        const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    }
    catch (err) {
        throw new Error(`[crypto] Falha ao descriptografar: ${err.message}`);
    }
}
/**
 * Verifica se uma string parece estar criptografada (formato base64 com tamanho mínimo)
 */
function isEncrypted(value) {
    if (!value)
        return false;
    // Mínimo: IV(12) + AuthTag(16) + 1 byte = 29 bytes = ~40 chars base64
    if (value.length < 40)
        return false;
    // Tentar decodificar
    try {
        const buffer = Buffer.from(value, 'base64');
        return buffer.length >= 29;
    }
    catch (_a) {
        return false;
    }
}
/**
 * Helper para descriptografar opcionalmente (se já está em plaintext, retorna como está)
 * Útil para migração gradual
 */
function decryptIfEncrypted(value, tenantId) {
    if (!value)
        return '';
    if (isEncrypted(value)) {
        return decrypt(value, tenantId);
    }
    return value; // Plaintext legado
}
//# sourceMappingURL=crypto.js.map