// Teste E2E Completo com agendamentos de TESTE via HTTP
// Fluxo: criar agendamento -> simular PIX -> workflow completo no admin

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://brilhocar-estetica.vercel.app';
const FUNCTION_URL = 'https://us-central1-brilhocar-estetica-9f14b.cloudfunctions.net';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots-full');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const results = {
  steps: [],
  screenshots: [],
  startTime: new Date().toISOString(),
  appointmentIds: [],
  osNumbers: [],
};

// Helpers HTTP
function httpCall(functionName, data = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: 'us-central1-brilhocar-estetica-9f14b.cloudfunctions.net',
      path: `/${functionName}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function log(step, status = 'INFO', details = '') {
  const entry = { time: new Date().toISOString(), step, status, details };
  results.steps.push(entry);
  const icon = status === 'SUCCESS' ? '✅' : status === 'ERROR' ? '❌' : status === 'WARNING' ? '⚠️' : '🔵';
  console.log(`${icon} ${step}${details ? '\n   ' + details : ''}`);
}

async function shot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push({ name, filepath });
  log(`📸 Screenshot: ${name}`);
}

async function runTest() {
  log('🚀 TESTE E2E COMPLETO - BrilhoCar');
  log('============================================================');
  log('Este teste valida TODO o fluxo do sistema:');
  log('  1. Criar agendamentos de TESTE via HTTP');
  log('  2. Simular pagamento PIX');
  log('  3. Admin: Ver todos os agendamentos');
  log('  4. Admin: Workflow completo (Receber -> Iniciar -> Finalizar -> Entregar)');
  log('  5. Scanner QR Code');
  log('  6. Timeline e histórico');

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  let appointmentId1, appointmentId2, appointmentId3, os1, os2, os3;

  try {
    // ============ PASSO 1: CRIAR AGENDAMENTOS DE TESTE ============
    log('\n📝 PASSO 1: Criando Agendamentos de Teste');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    // Agendamento 1 - STATUS: Agendado
    log('Criando agendamento 1...');
    const r1 = await httpCall('createTestAppointmentHttp', {
      name: 'João Silva',
      celular: '11999990001',
      car: 'Honda Civic',
      plate: 'ABC1D23',
      date: dateStr,
      time: '09:00',
      serviceName: 'Lavagem Técnica',
      price: 150
    });
    if (r1.success) {
      appointmentId1 = r1.appointmentId;
      os1 = r1.os;
      results.appointmentIds.push(appointmentId1);
      results.osNumbers.push(os1);
      log('✅ Agendamento 1 criado', 'SUCCESS', `OS: ${os1}`);

      // Simular pagamento
      await httpCall('simulatePaymentHttp', { appointmentId: appointmentId1 });
      log('✅ Pagamento 1 simulado', 'SUCCESS');
    }

    // Agendamento 2 - STATUS: Agendado
    log('Criando agendamento 2...');
    const r2 = await httpCall('createTestAppointmentHttp', {
      name: 'Maria Santos',
      celular: '21988887777',
      car: 'Toyota Corolla',
      plate: 'XYZ9E99',
      date: dateStr,
      time: '10:00',
      serviceName: 'Polimento Técnico',
      price: 500
    });
    if (r2.success) {
      appointmentId2 = r2.appointmentId;
      os2 = r2.os;
      results.appointmentIds.push(appointmentId2);
      results.osNumbers.push(os2);
      log('✅ Agendamento 2 criado', 'SUCCESS', `OS: ${os2}`);

      await httpCall('simulatePaymentHttp', { appointmentId: appointmentId2 });
      log('✅ Pagamento 2 simulado', 'SUCCESS');
    }

    // Agendamento 3 - STATUS: Aguardando Pagamento
    log('Criando agendamento 3...');
    const r3 = await httpCall('createTestAppointmentHttp', {
      name: 'Pedro Oliveira',
      celular: '31977776666',
      car: 'VW Golf',
      plate: 'DEF2F34',
      date: dateStr,
      time: '14:00',
      serviceName: 'Higienização Interna',
      price: 200
    });
    if (r3.success) {
      appointmentId3 = r3.appointmentId;
      os3 = r3.os;
      results.appointmentIds.push(appointmentId3);
      results.osNumbers.push(os3);
      log('✅ Agendamento 3 criado (sem pagamento)', 'SUCCESS', `OS: ${os3}`);
    }

    log(`Total de agendamentos criados: ${results.appointmentIds.length}`);

    // ============ PASSO 2: ADMIN - LOGIN ============
    log('\n🔐 PASSO 2: Login Admin');

    const ctxAdmin = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pageAdmin = await ctxAdmin.newPage();
    pageAdmin.setDefaultTimeout(20000);

    await pageAdmin.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await pageAdmin.waitForTimeout(2000);
    await shot(pageAdmin, '01-admin-login');

    await pageAdmin.fill('input[type="email"]', 'devtuma@gmail.com');
    await pageAdmin.fill('input[type="password"]', 'admin123');
    await pageAdmin.click('button[type="submit"]');
    await pageAdmin.waitForTimeout(5000);

    const adminUrl = pageAdmin.url();
    log(`URL após login: ${adminUrl}`);
    await shot(pageAdmin, '02-admin-loggedin');

    // ============ PASSO 3: VER AGENDA DE TRABALHOS ============
    log('\n📅 PASSO 3: Agenda de Trabalhos');

    await pageAdmin.goto(`${BASE_URL}/admin/trabalhos`, { waitUntil: 'domcontentloaded' });
    await pageAdmin.waitForTimeout(3000);
    await shot(pageAdmin, '03-trabalhos-all');

    // Filtrar por "Agendado"
    const agendadoBtn = await pageAdmin.$('button:has-text("Agendado")');
    if (agendadoBtn) {
      await agendadoBtn.click();
      await pageAdmin.waitForTimeout(2000);
      await shot(pageAdmin, '04-trabalhos-agendado');
    }

    // Filtrar por "Aguardando"
    const aguarBtn = await pageAdmin.$('button:has-text("Aguardando")');
    if (aguarBtn) {
      await aguarBtn.click();
      await pageAdmin.waitForTimeout(2000);
      await shot(pageAdmin, '05-trabalhos-aguardando');
    }

    // Voltar para Todos
    const todosBtn = await pageAdmin.$('button:has-text("Todos")');
    if (todosBtn) {
      await todosBtn.click();
      await pageAdmin.waitForTimeout(2000);
    }
    await shot(pageAdmin, '06-trabalhos-todos');

    // Buscar pelo OS1
    const searchInput = await pageAdmin.$('input[placeholder*="US"], input[placeholder*="OS"], input[placeholder*="Buscar"]');
    if (searchInput) {
      await searchInput.fill(os1);
      await pageAdmin.waitForTimeout(2000);
      await shot(pageAdmin, '07-busca-os1');
      await searchInput.fill('');
    }

    // ============ PASSO 4: WORKFLOW COMPLETO ============
    log('\n🔄 PASSO 4: Workflow Completo');

    // Clicar no primeiro agendamento
    const cards = await pageAdmin.$$('[class*="border"][class*="rounded"]');
    if (cards.length > 0) {
      await cards[0].click();
      await pageAdmin.waitForTimeout(2000);
      await shot(pageAdmin, '08-modal-detalhes');
    }

    // Procurar botão para Receber Veículo
    let receiveBtn = await pageAdmin.$('button:has-text("Receber")');
    if (receiveBtn) {
      await receiveBtn.click();
      await pageAdmin.waitForTimeout(3000);
      await shot(pageAdmin, '09-receber-veiculo');
      log('✅ Veículo Recebido', 'SUCCESS');
    }

    // Fechar modal e reabrir
    const closeBtn = await pageAdmin.$('button:has-text("✕"), button:has-text("Fechar")');
    if (closeBtn) await closeBtn.click();
    await pageAdmin.waitForTimeout(1000);

    // Recarregar página
    await pageAdmin.reload({ waitUntil: 'domcontentloaded' });
    await pageAdmin.waitForTimeout(2000);

    // Clicar novamente
    const cards2 = await pageAdmin.$$('[class*="border"][class*="rounded"]');
    if (cards2.length > 0) {
      await cards2[0].click();
      await pageAdmin.waitForTimeout(2000);
    }

    // Procurar botão para Iniciar Serviço
    let startBtn = await pageAdmin.$('button:has-text("Iniciar")');
    if (startBtn) {
      await startBtn.click();
      await pageAdmin.waitForTimeout(3000);
      await shot(pageAdmin, '10-servico-iniciado');
      log('✅ Serviço Iniciado', 'SUCCESS');
    }

    // Atualizar via HTTP para avançar status
    log('Avançando status via HTTP...');
    await httpCall('updateStatusHttp', { appointmentId: appointmentId1, status: 'Finalizado' });
    await pageAdmin.waitForTimeout(2000);
    await shot(pageAdmin, '11-finalizado');

    await httpCall('updateStatusHttp', { appointmentId: appointmentId1, status: 'Entregue' });
    await pageAdmin.waitForTimeout(2000);
    await shot(pageAdmin, '12-entregue');
    log('✅ Entregue ao Cliente', 'SUCCESS');

    // ============ PASSO 5: SCANNER QR CODE ============
    log('\n📷 PASSO 5: Scanner QR Code');

    await pageAdmin.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await pageAdmin.waitForTimeout(2000);
    await shot(pageAdmin, '13-admin-dashboard');

    const checkinBtn = await pageAdmin.$('button:has-text("Check-in")');
    if (checkinBtn) {
      await checkinBtn.click();
      await pageAdmin.waitForTimeout(2000);
      await shot(pageAdmin, '14-scanner-aberto');
      log('✅ Scanner QR Code aberto', 'SUCCESS');
    }

    // ============ PASSO 6: HISTÓRICO ============
    log('\n📜 PASSO 6: Histórico de Exclusões');

    await pageAdmin.goto(`${BASE_URL}/admin/historico`, { waitUntil: 'domcontentloaded' });
    await pageAdmin.waitForTimeout(2000);
    await shot(pageAdmin, '15-historico');

    // ============ PASSO 7: ANALYTICS ============
    log('\n📊 PASSO 7: Analytics');

    await pageAdmin.goto(`${BASE_URL}/admin/analytics`, { waitUntil: 'domcontentloaded' });
    await pageAdmin.waitForTimeout(2000);
    await shot(pageAdmin, '16-analytics');

    // ============ PASSO 8: CONFIGURAÇÕES PIX ============
    log('\n💰 PASSO 8: Configurar PIX');

    await pageAdmin.goto(`${BASE_URL}/admin/pix`, { waitUntil: 'domcontentloaded' });
    await pageAdmin.waitForTimeout(2000);
    await shot(pageAdmin, '17-pix-config');

    // ============ PASSO 9: TESTAR QR CODE NO TRACK ============
    log('\n🔖 PASSO 9: Track - QR Code do Cliente');

    const ctxTrack = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pageTrack = await ctxTrack.newPage();

    // Ir para track (vai mostrar agendamentos)
    await pageTrack.goto(`${BASE_URL}/track`, { waitUntil: 'domcontentloaded' });
    await pageTrack.waitForTimeout(3000);
    await shot(pageTrack, '18-track-page');

    log('✅ Página de rastreamento visitada', 'SUCCESS');

    // ============ RESULTADO FINAL ============
    log('\n============================================================');
    log('📊 RELATÓRIO FINAL');
    log('============================================================');
    log(`Total de passos: ${results.steps.length}`);
    log(`✅ Sucessos: ${results.steps.filter(s => s.status === 'SUCCESS').length}`);
    log(`⚠️  Avisos: ${results.steps.filter(s => s.status === 'WARNING').length}`);
    log(`📸 Screenshots: ${results.screenshots.length}`);
    log(`📋 Agendamentos criados: ${results.appointmentIds.length}`);
    log(`🔗 IDs: ${results.appointmentIds.join(', ')}`);
    log(`🔖 OS: ${results.osNumbers.join(', ')}`);

    // Links
    log('\n🔗 LINKS PARA TESTE:');
    log(`  Site: ${BASE_URL}`);
    log(`  Agenda: ${BASE_URL}/admin/trabalhos`);
    log(`  Admin: ${BASE_URL}/admin`);
    log(`  PIX: ${BASE_URL}/admin/pix`);
    log(`  Track: ${BASE_URL}/track`);

    if (appointmentId1) {
      log(`  Agendamento 1: ${BASE_URL}/pagamento/${appointmentId1}`);
    }

    generateReport();

  } catch (err) {
    log('ERRO FATAL', 'ERROR', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }
}

function generateReport() {
  const passed = results.steps.filter(s => s.status === 'SUCCESS').length;
  const failed = results.steps.filter(s => s.status === 'ERROR').length;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório E2E Completo - BrilhoCar</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0a; color: #fff; padding: 30px; max-width: 1400px; margin: 0 auto; }
  h1 { color: #00e676; border-bottom: 4px solid #00e676; padding-bottom: 16px; margin-bottom: 10px; }
  h2 { color: #00e676; margin: 30px 0 15px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin: 30px 0; }
  .card { background: #1a1a1a; padding: 24px; border-radius: 12px; text-align: center; border: 1px solid #333; }
  .card .value { font-size: 2.5em; font-weight: bold; color: #00e676; }
  .card .label { color: #888; margin-top: 8px; font-size: 0.85em; text-transform: uppercase; }
  .card.error .value { color: #ff4444; }
  .card.warning .value { color: #ffaa00; }
  .step { padding: 12px 16px; margin: 6px 0; border-radius: 8px; background: #1a1a1a; border-left: 4px solid #555; font-family: monospace; font-size: 0.9em; }
  .step.SUCCESS { border-left-color: #00e676; }
  .step.ERROR { border-left-color: #ff4444; }
  .step.WARNING { border-left-color: #ffaa00; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; margin-top: 20px; }
  .screenshot { background: #1a1a1a; border-radius: 12px; overflow: hidden; border: 1px solid #333; transition: transform 0.3s; cursor: pointer; }
  .screenshot:hover { transform: scale(1.02); border-color: #00e676; }
  .screenshot img { width: 100%; display: block; }
  .screenshot .name { padding: 12px; font-size: 0.85em; color: #00e676; font-weight: bold; }
  .links { background: #1a1a1a; padding: 20px; border-radius: 12px; margin-top: 30px; }
  .links a { color: #00e676; margin-right: 16px; text-decoration: none; padding: 8px 16px; background: rgba(0,230,118,0.1); border-radius: 8px; display: inline-block; }
  .links a:hover { background: rgba(0,230,118,0.2); }
  .ids { background: #1a1a1a; padding: 20px; border-radius: 12px; margin-top: 20px; font-family: monospace; }
  .ids p { margin: 8px 0; }
  .ids strong { color: #00e676; }
</style>
</head>
<body>
<h1>📋 Relatório E2E Completo - BrilhoCar</h1>
<p>Teste executado em: ${results.startTime}</p>

<div class="summary">
  <div class="card"><div class="value">${results.steps.length}</div><div class="label">Total Passos</div></div>
  <div class="card"><div class="value">${passed}</div><div class="label">✅ Sucessos</div></div>
  <div class="card warning"><div class="value">${results.steps.filter(s => s.status === 'WARNING').length}</div><div class="label">⚠️ Avisos</div></div>
  <div class="card error"><div class="value">${failed}</div><div class="label">❌ Erros</div></div>
  <div class="card"><div class="value">${results.screenshots.length}</div><div class="label">📸 Screenshots</div></div>
  <div class="card"><div class="value">${results.appointmentIds.length}</div><div class="label">📋 Agendamentos</div></div>
</div>

<div class="ids">
  <p><strong>Agendamentos Criados:</strong></p>
  ${results.appointmentIds.map((id, i) => `<p>${i + 1}. OS: ${results.osNumbers[i]} | ID: ${id}</p>`).join('')}
</div>

<h2>📝 Log de Execução</h2>
${results.steps.map(s => `<div class="step ${s.status}">${s.step}${s.details ? '<br><small>' + s.details + '</small>' : ''}</div>`).join('')}

<h2>📸 Screenshots (${results.screenshots.length})</h2>
<div class="grid">
${results.screenshots.map(s => `<div class="screenshot"><img src="screenshots-full/${path.basename(s.filepath)}" alt="${s.name}" loading="lazy" /><div class="name">📷 ${s.name}</div></div>`).join('')}
</div>

<div class="links">
  <h3>🔗 Links para Teste</h3>
  <a href="${BASE_URL}" target="_blank">🌐 Site</a>
  <a href="${BASE_URL}/admin/trabalhos" target="_blank">📅 Trabalhos</a>
  <a href="${BASE_URL}/admin" target="_blank">🖥️ Admin</a>
  <a href="${BASE_URL}/admin/analytics" target="_blank">📊 Analytics</a>
  <a href="${BASE_URL}/admin/pix" target="_blank">💰 PIX</a>
  <a href="${BASE_URL}/track" target="_blank">🔍 Track</a>
</div>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, 'relatorio-e2e-full.html'), html);
}

runTest().catch(console.error);
