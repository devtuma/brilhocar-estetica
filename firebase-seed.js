/* ============================================================
   SEED DO FIREBASE — BrilhoCar (v3 - CORREÇÃO DEFINITIVA)
   ============================================================
   COPIE E COLE NO CONSOLE - Aguarde carregar antes de executar
   ============================================================
*/

(async function() {
    console.clear();
    console.log('%c🌱 SEED BRILHO CAR', 'color:#39FF14;font-size:20px;font-weight:bold');
    console.log('========================================');

    // 1) Verificar Firebase
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase não carregou');
        console.log('💡 Solução: Recarregue a página com Ctrl+Shift+R e tente de novo');
        return;
    }
    console.log('✅ Firebase SDK carregado');

    // 2) Verificar config
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || cfg.apiKey.includes('SUA_API_KEY')) {
        console.error('❌ FIREBASE_CONFIG não encontrado ou inválido');
        console.log('cfg =', cfg);
        return;
    }
    console.log('✅ Config encontrada:', cfg.projectId);

    // 3) Inicializar Firebase
    let app;
    try {
        if (firebase.apps.length === 0) {
            app = firebase.initializeApp(cfg);
            console.log('✅ Firebase inicializado');
        } else {
            app = firebase.apps[0];
            console.log('✅ Firebase já estava inicializado');
        }
    } catch (e) {
        console.error('❌ Erro ao inicializar Firebase:', e.message);
        return;
    }

    const db = firebase.firestore();

    // 4) Criar settings/business
    try {
        await db.collection('settings').doc('business').set({
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
            stats: [
                { value: 500, suffix: '+', label: 'Carros Atendidos' },
                { value: 5, suffix: '+', label: 'Anos de Experiência' },
                { value: 4.9, suffix: '★', label: 'Avaliação no Google', isDecimal: true },
                { value: 100, suffix: '%', label: 'Satisfação Garantida' }
            ],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ settings/business salvo');
    } catch (e) {
        console.error('❌ Erro em settings:', e.code, '-', e.message);
        if (e.code === 'permission-denied') {
            console.log('💡 Você precisa colar as regras em Firestore > Rules');
        }
        return;
    }

    // 5) Criar serviços
    const servicos = [
        { nome: 'Lavagem Completa', preco: 80, duracao: '1-2h', descricao: 'Lavagem externa e interna completa.', ativo: true, ordem: 1 },
        { nome: 'Polimento Técnico', preco: 250, duracao: '4-6h', descricao: 'Remoção de riscos e oxidação.', ativo: true, ordem: 2 },
        { nome: 'Vitrificação', preco: 800, duracao: '1 dia', descricao: 'Proteção cerâmica de longa duração.', ativo: true, ordem: 3 },
        { nome: 'Higienização Interna', preco: 200, duracao: '3-4h', descricao: 'Bancos, tapetes, teto e painel.', ativo: true, ordem: 4 },
        { nome: 'PPF — Proteção de Pintura', preco: 0, duracao: 'Variável', descricao: 'Película poliuretano.', ativo: true, ordem: 5 },
        { nome: 'Lavagem Premium', preco: 150, duracao: '2-3h', descricao: 'Lavagem + cera + pneus.', ativo: true, ordem: 6 }
    ];

    try {
        const existing = await db.collection('services').get();
        for (const d of existing.docs) await d.ref.delete();
    } catch(e) {}

    for (const s of servicos) {
        try {
            await db.collection('services').add({
                ...s,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch(e) {
            console.error('❌', s.nome, '-', e.message);
        }
    }
    console.log('✅ 6 serviços criados');

    // 6) Criar depoimentos
    const deps = [
        { nome: 'Marcos A.', veiculo: 'Honda Civic', texto: 'Levei meu Civic para polimento e fiquei impressionado. Profissionalismo total.', estrelas: 5, ativo: true, ordem: 1 },
        { nome: 'Rodrigo S.', veiculo: 'Toyota Corolla', texto: 'Vitrificação impecável, brilho incrível.', estrelas: 5, ativo: true, ordem: 2 },
        { nome: 'Ana C.', veiculo: 'Volkswagen T-Cross', texto: 'Higienização impecável. Tirou odor de cigarro.', estrelas: 5, ativo: true, ordem: 3 },
        { nome: 'Felipe M.', veiculo: 'Chevrolet Onix', texto: 'Preço justo e atendimento excelente. Super recomendo.', estrelas: 5, ativo: true, ordem: 4 }
    ];

    try {
        const existing = await db.collection('testimonials').get();
        for (const d of existing.docs) await d.ref.delete();
    } catch(e) {}

    for (const d of deps) {
        try {
            await db.collection('testimonials').add({
                ...d,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch(e) {}
    }
    console.log('✅ 4 depoimentos criados');

    // 7) Verificar
    try {
        const allSettings = await db.collection('settings').get();
        const allServices = await db.collection('services').get();
        const allTest = await db.collection('testimonials').get();
        console.log('========================================');
        console.log('📊 VERIFICAÇÃO FINAL:');
        console.log('   settings:', allSettings.size);
        console.log('   services:', allServices.size);
        console.log('   testimonials:', allTest.size);
        console.log('========================================');
        console.log('%c🎉 SEED COMPLETO!', 'color:#39FF14;font-size:18px;font-weight:bold');
        console.log('Recarregue o admin (Ctrl+Shift+R) e faça login');
    } catch(e) {
        console.error('Erro na verificação:', e.message);
    }
})();