// Criar usuário de teste via Firebase Auth API
const https = require('https');

const PROJECT_ID = 'brilhocar-estetica-9f14b';
const API_KEY = 'AIzaSyDemo'; // placeholder - não vamos usar assim

// Este script é apenas para referência
// Para criar usuários de verdade, use:
// 1. Firebase Console -> Authentication -> Add user
// 2. Ou use a Firebase CLI com service account

console.log('Para criar usuários de teste:');
console.log('1. Acesse https://console.firebase.google.com/project/brilhocar-estetica-9f14b/authentication');
console.log('2. Clique em "Adicionar usuário"');
console.log('3. Adicione:');
console.log('   - Email: test@brilhocar.com');
console.log('   - Senha: Teste@123');
console.log('');
console.log('OU use o painel admin para se tornar admin e criar agendamentos de teste.');
