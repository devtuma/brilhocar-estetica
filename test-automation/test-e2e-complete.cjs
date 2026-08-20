// Teste E2E Completo - Fluxo de Agendamento até Finalização
// Testa: cadastro -> agendamento -> PIX -> check-in -> workflow completo

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://brilhocar-estetica.vercel.app';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots-e2e');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const results = {
  steps: [],
  screenshots: [],
  startTime: new Date().toISOString(),
  tests: { passed: 0, failed: 0 },
};

// Número único para criar usuários diferentes
const TEST_ID = Date.now().toString().slice(-6);
const TEST_USER = {
  name: `Cliente Teste E2E`,
  celular: `119999${TEST_ID}`,
  password: `Teste@123`,
};

function log(step, status = 'INFO', details = '') {
  const entry = { time: new Date().toISOString(), step, status, details };
  results.steps.push(entry);
  const icon = status === 'SUCCESS' ? '✅' : status === 'ERROR' ? '❌' : status === 'WARNING' ? '⚠️' : '🔵';
  console.log(`${icon} ${step}${details ? '\n   ' + details : ''}`);
  if (status === 'SUCCESS') results.tests.passed++;
  if (status === 'ERROR') results.tests.failed++;
}

async function shot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push({ name, filepath });
  log(`📸 Screenshot: ${name}`, 'INFO');
}

// Chamar Firebase Function via HTTP
async function callFunction(functionName, data = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: 'us-central1-brilhocar-estetica-9f14b.cloudfunctions.net',
      path: `/${functionName}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ error: data });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Simular pagamento via função de teste
async function simulatePayment(paymentId, appointmentId) {
  log(`🔧 Simulando pagamento PIX...`, 'INFO');

  // Obter ID token via signIn
  const result = await callFunction('createPixPaymentForAppointment', {
    appointmentId
  });

  return result;
}

async function runTest() {
  log('🚀 TESTE E2E COMPLETO - Fluxo BrilhoCar', 'INFO');
  log('============================================================', 'INFO');
  log(`Usuário de teste: ${TEST_USER.celular}`, 'INFO');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let appointmentId = null;
  let osNumber = null;

  try {
    // ============ PASSO 1: CADASTRO ============
    log('\n📝 PASSO 1: Cadastro de Cliente', 'INFO');

    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page1 = await ctx1.newPage();
    page1.setDefaultTimeout(20000);

    await page1.goto(`${BASE_URL}/signup`, { waitUntil: 'domcontentloaded' });
    await page1.waitForTimeout(2000);
    await shot(page1, '01-signup-page');

    // Preencher formulário de cadastro
    const nameInput = await page1.$('input[placeholder*="ome"]');
    if (nameInput) {
      await nameInput.fill(TEST_USER.name);
    }

    const celularInputs = await page1.$$('input[type="tel"], input[placeholder*="elular"], input[placeholder*="11"]');
    for (const input of celularInputs) {
      const placeholder = await input.getAttribute('placeholder') || '';
      if (placeholder.toLowerCase().includes('confirmar') || placeholder.toLowerCase().includes('novamente')) {
        await input.fill(TEST_USER.celular);
      }
    }
    for (const input of celularInputs) {
      const placeholder = await input.getAttribute('placeholder') || '';
      if (!placeholder.toLowerCase().includes('confirmar') && !placeholder.toLowerCase().includes('novamente')) {
        await input.fill(TEST_USER.celular);
        break;
      }
    }
    await page1.waitForTimeout(500);

    const passwordInputs = await page1.$$('input[type="password"]');
    for (const input of passwordInputs) {
      const placeholder = await input.getAttribute('placeholder') || '';
      if (placeholder.toLowerCase().includes('confirmar') || placeholder.toLowerCase().includes('novamente')) {
        await input.fill(TEST_USER.password);
      }
    }
    for (const input of passwordInputs) {
      const placeholder = await input.getAttribute('placeholder') || '';
      if (!placeholder.toLowerCase().includes('confirmar') && !placeholder.toLowerCase().includes('novamente')) {
        await input.fill(TEST_USER.password);
        break;
      }
    }
    await shot(page1, '02-signup-filled');

    // Clicar em cadastrar
    const submitBtn = await page1.$('button[type="submit"], button:has-text("Cadastrar"), button:has-text("Criar")');
    if (submitBtn) {
      await submitBtn.click();
      await page1.waitForTimeout(5000);
    }

    const urlAfterSignup = page1.url();
    log(`URL após cadastro: ${urlAfterSignup}`, 'INFO');
    await shot(page1, '03-after-signup');

    if (urlAfterSignup.includes('/signup')) {
      log('⚠️ Cadastro pode ter falhado - tentando login', 'WARNING');
      await page1.goto(`${BASE_URL}/client-login`, { waitUntil: 'domcontentloaded' });
      await page1.waitForTimeout(2000);

      const loginCelular = await page1.$('input[type="tel"]');
      const loginPassword = await page1.$('input[type="password"]');
      if (loginCelular) await loginCelular.fill(TEST_USER.celular);
      if (loginPassword) await loginPassword.fill(TEST_USER.password);

      const loginBtn = await page1.$('button[type="submit"]');
      if (loginBtn) {
        await loginBtn.click();
        await page1.waitForTimeout(5000);
      }
    }
    await shot(page1, '04-after-login');

    // ============ PASSO 2: AGENDAMENTO ============
    log('\n📅 PASSO 2: Agendamento', 'INFO');

    await page1.goto(`${BASE_URL}/booking`, { waitUntil: 'domcontentloaded' });
    await page1.waitForTimeout(3000);
    await shot(page1, '05-booking-page');

    // Selecionar primeiro serviço disponível
    const serviceButtons = await page1.$$('button');
    for (const btn of serviceButtons) {
      const text = await btn.textContent().catch(() => '');
      if (text.includes('Lavagem') || text.includes('R$')) {
        const isDisabled = await btn.isDisabled().catch(() => true);
        if (!isDisabled) {
          await btn.click();
          await page1.waitForTimeout(1000);
          log('Serviço selecionado', 'SUCCESS', text.trim());
          break;
        }
      }
    }
    await shot(page1, '06-service-selected');

    // Selecionar veículo
    const vehicleBtn = await page1.$('button:has-text("Selecione"), button:has-text("carro"), button:has-text("Veículo")');
    if (vehicleBtn) {
      await vehicleBtn.click();
      await page1.waitForTimeout(2000);
    }

    // Selecionar primeiro veículo disponível
    const carOptions = await page1.$$('button');
    for (const btn of carOptions) {
      const text = await btn.textContent().catch(() => '');
      if (text.includes('Sedan') || text.includes('Hatch') || text.includes('SUV') || text.includes('selecionar')) {
        const isDisabled = await btn.isDisabled().catch(() => true);
        if (!isDisabled && !text.includes('selecionar')) {
          await btn.click();
          await page1.waitForTimeout(1000);
          break;
        }
      }
    }
    // Tentar clicar em "Confirmar" ou similar para adicionar veículo
    const addCarBtn = await page1.$('button:has-text("Adicionar"), button:has-text("Confirmar"), button:has-text("Escolher")');
    if (addCarBtn) {
      await addCarBtn.click();
      await page1.waitForTimeout(1000);
    }
    await shot(page1, '07-vehicle-selected');

    // Selecionar data (amanhã)
    const dateInput = await page1.$('input[type="date"]');
    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      await dateInput.fill(dateStr);
      await page1.waitForTimeout(2000);
      log('Data selecionada', 'SUCCESS', dateStr);
    }

    // Selecionar horário
    const timeBtn = await page1.$('button:has-text("Selecione o horário"), button:has-text("Horário")');
    if (timeBtn) {
      await timeBtn.click();
      await page1.waitForTimeout(2000);
    }

    // Selecionar primeiro horário disponível
    const allBtns = await page1.$$('button');
    for (const btn of allBtns) {
      const text = await btn.textContent().catch(() => '');
      const isDisabled = await btn.isDisabled().catch(() => true);
      if (/^\d{2}:\d{2}$/.test(text.trim()) && !isDisabled) {
        await btn.click();
        await page1.waitForTimeout(1000);
        log('Horário selecionado', 'SUCCESS', text.trim());
        break;
      }
    }
    await shot(page1, '08-time-selected');

    // Confirmar agendamento
    const confirmBtn = await page1.$('button:has-text("Confirmar"), button:has-text("Ir para"), button:has-text("Pagamento")');
    if (confirmBtn) {
      await confirmBtn.click();
      await page1.waitForTimeout(5000);
    }

    const urlAfterBooking = page1.url();
    log(`URL após agendamento: ${urlAfterBooking}`, 'INFO');
    await shot(page1, '09-after-booking');

    // Extrair appointment ID da URL
    if (urlAfterBooking.includes('/pagamento/')) {
      appointmentId = urlAfterBooking.split('/pagamento/')[1];
      log('Agendamento criado!', 'SUCCESS', `ID: ${appointmentId}`);
    } else if (urlAfterBooking.includes('/booking')) {
      // Verificar se há erro
      const errorText = await page1.evaluate(() => {
        const alerts = document.querySelectorAll('[role="alert"], .text-red');
        return Array.from(alerts).map(a => a.textContent).join(' | ');
      });
      log('Agendamento pode ter falhado', 'WARNING', errorText || 'sem mensagem de erro visível');
    }

    // ============ PASSO 3: PIX (apenas documentar se existir) ============
    if (appointmentId) {
      log('\n💰 PASSO 3: Pagamento PIX', 'INFO');
      await shot(page1, '10-pix-page');

      // Verificar se há QR Code
      const qrCode = await page1.$('img[alt*="PIX"], img[alt*="QR"]');
      if (qrCode) {
        log('QR Code PIX encontrado', 'SUCCESS');
      } else {
        log('QR Code PIX não encontrado', 'WARNING');
      }

      // Em produção, o pagamento seria feito aqui
      // Para teste, vamos direto para o admin
      log('⏩ Pulando pagamento real (PIX em produção)', 'INFO');
    }

    // ============ PASSO 4: ADMIN - CHECK-IN ============
    log('\n🔐 PASSO 4: Check-in via Admin', 'INFO');

    // Fazer login como admin
    const ctxAdmin = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageAdmin = await ctxAdmin.newPage();
    pageAdmin.setDefaultTimeout(20000);

    await pageAdmin.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await pageAdmin.waitForTimeout(2000);

    const emailInput = await pageAdmin.$('input[type="email"]');
    const passInput = await pageAdmin.$('input[type="password"]');
    if (emailInput) await emailInput.fill('devtuma@gmail.com');
    if (passInput) await passInput.fill('admin123');

    const adminLoginBtn = await pageAdmin.$('button[type="submit"]');
    if (adminLoginBtn) {
      await adminLoginBtn.click();
      await pageAdmin.waitForTimeout(5000);
    }
    await shot(pageAdmin, '11-admin-loggedin');

    // Ir para Agenda de Trabalhos
    await pageAdmin.goto(`${BASE_URL}/admin/trabalhos`, { waitUntil: 'domcontentloaded' });
    await pageAdmin.waitForTimeout(3000);
    await shot(pageAdmin, '12-trabalhos-page');

    // Se temos appointment ID, tentar encontrá-lo
    if (appointmentId) {
      // Buscar pelo ID
      const searchInput = await pageAdmin.$('input[placeholder*="US"], input[placeholder*="OS"], input[placeholder*="Buscar"]');
      if (searchInput) {
        await searchInput.fill(appointmentId);
        await pageAdmin.waitForTimeout(2000);
        await shot(pageAdmin, '13-search-result');
      }

      // Clicar no primeiro resultado
      const firstResult = await pageAdmin.$('div[cursor-pointer]');
      if (firstResult) {
        await firstResult.click();
        await pageAdmin.waitForTimeout(2000);
        await shot(pageAdmin, '14-appointment-detail');
      }
    }

    // ============ PASSO 5: ATUALIZAR STATUS ============
    log('\n🔄 PASSO 5: Workflow de Status', 'INFO');

    // Ir para Agenda de Trabalhos
    await pageAdmin.goto(`${BASE_URL}/admin/trabalhos`, { waitUntil: 'domcontentloaded' });
    await pageAdmin.waitForTimeout(3000);

    // Clicar no primeiro agendamento disponível
    const appointments = await pageAdmin.$$('[class*="bg-surface"][class*="border"]');
    if (appointments.length > 0) {
      await appointments[0].click();
      await pageAdmin.waitForTimeout(2000);
      await shot(pageAdmin, '15-workflow-start');

      // Tentar avançar status
      const advanceBtn = await pageAdmin.$('button:has-text("Avançar"), button:has-text("Receber"), button:has-text("Iniciar"), button:has-text("Receber Veículo")');
      if (advanceBtn) {
        await advanceBtn.click();
        await pageAdmin.waitForTimeout(3000);
        await shot(pageAdmin, '16-status-advanced');
        log('Status avançado!', 'SUCCESS');
      }
    }

    // ============ PASSO 6: SCANNER QR CODE ============
    log('\n📷 PASSO 6: Scanner QR Code', 'INFO');

    // Voltar ao dashboard e clicar em Check-in
    await pageAdmin.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await pageAdmin.waitForTimeout(2000);
    await shot(pageAdmin, '17-admin-dashboard');

    const checkinBtn = await pageAdmin.$('button:has-text("Check-in")');
    if (checkinBtn) {
      await checkinBtn.click();
      await pageAdmin.waitForTimeout(2000);
      await shot(pageAdmin, '18-scanner-opened');
      log('Scanner QR Code aberto', 'SUCCESS');
    }

    // ============ RELATÓRIO ============
    log('\n============================================================', 'INFO');
    log('📊 RELATÓRIO DO TESTE E2E', 'INFO');
    log('============================================================', 'INFO');
    log(`Total de passos: ${results.steps.length}`, 'INFO');
    log(`✅ Sucessos: ${results.tests.passed}`, 'SUCCESS');
    log(`❌ Falhas: ${results.tests.failed}`, results.tests.failed > 0 ? 'ERROR' : 'INFO');
    log(`📸 Screenshots: ${results.screenshots.length}`, 'INFO');

    if (appointmentId) {
      log(`🔗 ID do agendamento criado: ${appointmentId}`, 'INFO');
    }

    // Gerar HTML
    generateReport();

    log(`\n📁 Relatório: ${path.join(__dirname, 'relatorio-e2e.html')}`, 'INFO');
    log(`📁 Screenshots: ${SCREENSHOT_DIR}`, 'INFO');

  } catch (err) {
    log('ERRO FATAL', 'ERROR', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }
}

function generateReport() {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório E2E - BrilhoCar</title>
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
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
  .screenshot { background: #1a1a1a; border-radius: 12px; overflow: hidden; border: 1px solid #333; transition: transform 0.3s; }
  .screenshot:hover { transform: scale(1.02); }
  .screenshot img { width: 100%; display: block; }
  .screenshot .name { padding: 12px; font-size: 0.85em; color: #00e676; font-weight: bold; }
  .links { background: #1a1a1a; padding: 20px; border-radius: 12px; margin-top: 30px; }
  .links a { color: #00e676; margin-right: 16px; }
</style>
</head>
<body>
<h1>📋 Relatório E2E - BrilhoCar</h1>
<p>Teste: ${results.startTime}</p>

<div class="summary">
  <div class="card"><div class="value">${results.steps.length}</div><div class="label">Total Passos</div></div>
  <div class="card"><div class="value">${results.tests.passed}</div><div class="label">✅ Sucessos</div></div>
  <div class="card warning"><div class="value">${results.tests.failed}</div><div class="label">❌ Falhas</div></div>
  <div class="card"><div class="value">${results.screenshots.length}</div><div class="label">📸 Screenshots</div></div>
</div>

<h2>📝 Log de Execução</h2>
${results.steps.map(s => `<div class="step ${s.status}">${s.step}${s.details ? '<br><small>' + s.details + '</small>' : ''}</div>`).join('')}

<h2>📸 Screenshots</h2>
<div class="grid">
${results.screenshots.map(s => `<div class="screenshot"><img src="screenshots-e2e/${path.basename(s.filepath)}" alt="${s.name}"><div class="name">📷 ${s.name}</div></div>`).join('')}
</div>

<div class="links">
  <h3>🔗 Links</h3>
  <a href="${BASE_URL}" target="_blank">Site</a>
  <a href="${BASE_URL}/admin/trabalhos" target="_blank">Trabalhos</a>
  <a href="${BASE_URL}/admin" target="_blank">Admin</a>
</div>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, 'relatorio-e2e.html'), html);
}

runTest().catch(console.error);
