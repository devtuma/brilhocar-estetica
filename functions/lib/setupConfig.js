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
exports.setupInitialConfig = void 0;
// Cloud Function temporária para criar config no Firestore
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
exports.setupInitialConfig = (0, https_1.onRequest)(async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});
//# sourceMappingURL=setupConfig.js.map