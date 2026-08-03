/* ============================================================
   FIREBASE-CONFIG.JS — BrilhoCar Estética Automotiva
   Configuração do Firebase (Firestore + Auth + Storage)

   INSTRUÇÕES:
   1. Acesse console.firebase.google.com
   2. Crie um projeto "brilhocar-estetica"
   3. Habilite: Firestore Database, Authentication, Storage
   4. Vá em Configurações do Projeto > Seus apps > Web
   5. Copie a configuração e cole abaixo
   ============================================================ */

var FIREBASE_CONFIG = window.FIREBASE_CONFIG = {
    /* --- FIREBASE (Brilho Car Estética Automotiva) --- */
    apiKey:            'AIzaSyO8FaR87F73AkRLMFXJxFVJg4XFQJKVPQM',
    authDomain:        'brilhocar-estetica.firebaseapp.com',
    projectId:         'brilhocar-estetica',
    storageBucket:     'brilhocar-estetica.firebasestorage.app',
    messagingSenderId: '542562856492',
    appId:             '1:542562856492:web:cafb728b8bb1d086c2eb89',

    /* --- CREDENCIAIS ADMIN (Firebase Auth) --- */
    ADMIN_EMAIL: 'admin@brilhocar.com',
    ADMIN_PASS: 'BrilhoCar2025!',

    /* --- VERSÃO --- */
    VERSION: '2.0.0-firebase',
};
