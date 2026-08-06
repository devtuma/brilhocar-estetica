/* ============================================================
   FIREBASE-CONFIG.JS — BrilhoCar Estética Automotiva
   Configuração do Firebase (Firestore + Auth + Storage)

   INSTRUÇÕES:
   1. Acesse console.firebase.google.com
   2. Vá em Configurações do Projeto > Seus apps > Web
   3. Copie a configuração e cole abaixo
   ============================================================ */

var FIREBASE_CONFIG = window.FIREBASE_CONFIG = {
    /* --- FIREBASE (Brilho Car Estética Automotiva) --- */
    apiKey:            'AIzaSyB5CjK3f7NaXpvqabUHOO0IKiKqhWd6eIQ',
    authDomain:        'brilhocar-estetica-9f14b.firebaseapp.com',
    projectId:         'brilhocar-estetica-9f14b',
    storageBucket:     'brilhocar-estetica-9f14b.firebasestorage.app',
    messagingSenderId: '1084811695946',
    appId:             '1:1084811695946:web:af8d9f7d4df175a03353b3',

    /* --- CREDENCIAIS ADMIN (Firebase Auth) --- */
    ADMIN_EMAIL: 'devtuma@gmail.com',
    ADMIN_PASS: '12345678',

    /* --- VERSÃO --- */
    VERSION: '2.0.0-firebase',
};
