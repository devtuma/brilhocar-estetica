/* ============================================================
   DIAGNÓSTICO FIREBASE — BrilhoCar
   ============================================================
   COMO USAR:
   1. Abra o site (index.html, booking.html ou admin/index.html)
   2. Abra o Console (F12)
   3. Cole TODO este conteúdo no console
   4. Pressione Enter
   5. Veja os resultados detalhados
   ============================================================
*/

(async function diagnose() {
    console.log('========================================');
    console.log('🔍 DIAGNÓSTICO FIREBASE - BRILHO CAR');
    console.log('========================================\n');

    // 1) Verificar credenciais
    console.log('1️⃣ Verificando credenciais...');
    const cfg = window.FIREBASE_CONFIG || {};
    console.log('   apiKey:', cfg.apiKey ? cfg.apiKey.substring(0, 20) + '...' : '❌ NÃO CONFIGURADO');
    console.log('   projectId:', cfg.projectId || '❌ NÃO CONFIGURADO');
    console.log('   authDomain:', cfg.authDomain || '❌');
    console.log('');

    // 2) Verificar SDK
    console.log('2️⃣ Verificando Firebase SDK...');
    console.log('   window.firebase:', typeof window.firebase !== 'undefined' ? '✅ Carregado' : '❌ Não carregou');
    if (typeof firebase !== 'undefined') {
        console.log('   Versão:', firebase.SDK_VERSION || 'N/A');
    }
    console.log('');

    // 3) Testar conexão com Firestore
    console.log('3️⃣ Testando conexão com Firestore...');
    try {
        const testDoc = await firebase.firestore().collection('settings').doc('business').get();
        if (testDoc.exists) {
            console.log('   ✅ settings/business EXISTE');
            console.log('   Dados:', testDoc.data());
        } else {
            console.log('   ⚠️ settings/business NÃO EXISTE');
            console.log('   → Criando dados iniciais...');
            await firebase.firestore().collection('settings').doc('business').set({
                businessName: 'BrilhoCar Estética Automotiva',
                tagline: 'BrilhoCar • Mauá',
                whatsapp: '5511999999999',
                instagram: 'brilhocar.estetica',
                address: 'Rua Aramis Forte, 340 — Mauá/SP',
                horario: 'Seg–Sáb: 8h às 18h',
                workingDays: [1, 2, 3, 4, 5, 6],
                workingHours: { start: '08:00', end: '18:00' },
                slotDuration: 60,
                breakTime: 15,
                maxPerDay: 8,
                blockedDates: [],
                activeTheme: 'default',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            console.log('   ✅ settings/business CRIADO');
        }
    } catch (e) {
        console.log('   ❌ ERRO ao acessar Firestore:');
        console.log('   ', e.code, '-', e.message);
        if (e.code === 'permission-denied') {
            console.log('\n   🔧 SOLUÇÃO: Cole as regras em Firestore > Rules');
        }
    }
    console.log('');

    // 4) Testar Auth
    console.log('4️⃣ Testando Authentication...');
    try {
        const user = firebase.auth().currentUser;
        if (user) {
            console.log('   ✅ Logado como:', user.email);
        } else {
            console.log('   ⚠️ Não logado (mas pode logar normalmente)');
        }
    } catch (e) {
        console.log('   ❌ Erro Auth:', e.message);
    }
    console.log('');

    // 5) Testar Collections
    console.log('5️⃣ Testando Collections...');
    const collections = ['settings', 'services', 'appointments', 'clients', 'transactions', 'testimonials'];
    for (const col of collections) {
        try {
            const snap = await firebase.firestore().collection(col).limit(1).get();
            console.log(`   ${col}: ✅ (${snap.size} doc(s) encontrados)`);
        } catch (e) {
            console.log(`   ${col}: ❌ ${e.code} - ${e.message}`);
        }
    }

    console.log('\n========================================');
    console.log('✅ DIAGNÓSTICO COMPLETO');
    console.log('========================================');
})();