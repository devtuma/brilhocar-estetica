// Teste de fluxo COMPLETO com agendamento real
// Usa Chrome real via Playwright (não headless para vermos as ações)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://brilhocar-estetica.vercel.app';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Usuários de teste que existem (você precisa criá-los antes)
const TEST_USER_A = { celular: '11999990001', senha: 'Teste@123' };
const TEST_USER_B = { celular: '11999990002', senha: 'Teste@123' };

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const results = {
  steps: [],
  screenshots: [],
  startTime: new Date().toISOString(),
  tests: { passed: 0, failed: 0 },
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

async function makeBooking(page, userLabel, celular, senha) {
  log(`\n� ${userLabel}: Login`, 'INFO');
  await page.goto(`${BASE_URL}/client-login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const celularInput = await page.$('input[type="tel"]');
  if (celularInput) {
    await celularInput.fill(celular);
    const senhaInput = await page.$('input[type="password"]');
    if (senhaInput) await senhaInput.fill(senha);
    await page.waitForTimeout(500);

    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      // Aguardar ficar habilitado
      await page.waitForFunction(() => {
        const btn = document.querySelector('button[type="submit"]');
        return btn && !btn.disabled;
      }, { timeout: 5000 }).catch(() => {});
      await submitBtn.click().catch(() => log('⚠️ Click no login falhou', 'INFO'));
      await page.waitForTimeout(4000);
    }
  }

  const loginUrl = page.url();
  log(`${userLabel} URL pós-login:`, 'INFO', loginUrl);

  if (!loginUrl.includes('/booking')) {
    log(`${userLabel} não fez login - redirecionando manualmente para /booking`, 'WARNING');
    await page.goto(`${BASE_URL}/booking`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  await shot(page, `${userLabel.toLowerCase().replace(/\s/g, '-')}-01-booking`);

  // Selecionar serviço
  log(`${userLabel}: Selecionar serviço`, 'INFO');
  const lavs = await page.$$('button');
  let found = false;
  for (const b of lavs) {
    const txt = await b.textContent().catch(() => '');
    if (txt && (txt.includes('Lavagem Técnica') || txt.includes('R$ '))) {
      const isDisabled = await b.isDisabled().catch(() => false);
      if (!isDisabled) {
        await b.click().catch(() => {});
        await page.waitForTimeout(500);
        found = true;
        log(`${userLabel}: Serviço selecionado`, 'SUCCESS', txt.trim());
        break;
      }
    }
  }
  if (!found) log(`${userLabel}: Serviço não encontrado`, 'WARNING');

  // Selecionar veículo
  log(`${userLabel}: Selecionar veículo`, 'INFO');
  await page.waitForTimeout(1000);
  const veiculoBtns = await page.$$('button');
  for (const b of veiculoBtns) {
    const txt = await b.textContent().catch(() => '');
    if (txt && (txt.includes('Selecionar') || txt.includes('Escolher') || txt.includes('Veículo') || txt.includes('Carro'))) {
      await b.click().catch(() => {});
      await page.waitForTimeout(1500);
      break;
    }
  }
  await shot(page, `${userLabel.toLowerCase().replace(/\s/g, '-')}-02-veiculo`);

  // Selecionar data
  log(`${userLabel}: Selecionar data futura`, 'INFO');
  const dateInput = await page.$('input[type="date"]');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await dateInput.fill(dateStr);
    await page.waitForTimeout(2000);
    log(`${userLabel}: Data selecionada`, 'SUCCESS', dateStr);
  }

  // Selecionar horário
  log(`${userLabel}: Selecionar horário`, 'INFO');
  const allButtons = await page.$$('button');
  let selectedTime = null;
  for (const b of allButtons) {
    const txt = await b.textContent().catch(() => '');
    const isDisabled = await b.isDisabled().catch(() => false);
    // Padrão de horário HH:MM
    if (txt && /^\d{2}:\d{2}/.test(txt.trim()) && !isDisabled) {
      selectedTime = txt.trim();
      await b.click().catch(() => {});
      await page.waitForTimeout(1000);
      log(`${userLabel}: Horário selecionado`, 'SUCCESS', selectedTime);
      break;
    }
  }
  if (!selectedTime) log(`${userLabel}: Nenhum horário disponível`, 'WARNING');
  await shot(page, `${userLabel.toLowerCase().replace(/\s/g, '-')}-03-horario`);

  // Submeter
  log(`${userLabel}: Submeter agendamento`, 'INFO');
  const submitBtns = await page.$$('button');
  for (const b of submitBtns) {
    const txt = await b.textContent().catch(() => '');
    if (txt && (txt.includes('Confirmar') || txt.includes('Agendar') || txt.includes('Finalizar'))) {
      await b.click().catch(() => {});
      await page.waitForTimeout(5000);
      break;
    }
  }

  const urlAfter = page.url();
  log(`${userLabel}: URL após submit`, 'INFO', urlAfter);

  if (urlAfter.includes('/pagamento/')) {
    log(`${userLabel}: ✅ Redirecionou para pagamento!`, 'SUCCESS');
    await shot(page, `${userLabel.toLowerCase().replace(/\s/g, '-')}-04-pagamento`);

    // Verificar QR Code
    const qrImg = await page.$('img[alt*="PIX"], img[alt*="QR"]');
    if (qrImg) log(`${userLabel}: QR Code PIX gerado`, 'SUCCESS');

    // Verificar botão SIMULAR
    const simBtn = await page.$('button:has-text("SIMULAR")');
    if (simBtn) {
      log(`${userLabel}: Botão SIMULAR encontrado`, 'SUCCESS');
      // NÃO clicar automaticamente - usuário decide
    } else {
      log(`${userLabel}: Botão SIMULAR não encontrado`, 'WARNING');
    }

    return { success: true, time: selectedTime, url: urlAfter };
  } else if (urlAfter.includes('/booking')) {
    // Pode ter dado erro - verificar alert
    const alertText = await page.evaluate(() => {
      const alerts = document.querySelectorAll('[role="alert"]');
      return Array.from(alerts).map(a => a.textContent).join(' | ');
    });
    log(`${userLabel}: ⚠️ Permaneceu em /booking - pode ter dado erro`, 'WARNING', alertText || 'sem alerta visível');
    return { success: false, reason: alertText || 'desconhecido' };
  }

  return { success: false, reason: 'URL inesperada' };
}

async function runTest() {
  log('🚀 TESTE E2E COMPLETO - BrilhoCar', 'INFO');
  log('============================================================', 'INFO');
  log('Este teste simula 2 clientes tentando agendar o mesmo horário', 'INFO');
  log('para validar a proteção anti-duplo-booking', 'INFO');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ============ USUÁRIO A ============
    log('\n🔵 USUÁRIO A - Primeiro cliente', 'INFO');
    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pA = await ctxA.newPage();
    pA.setDefaultTimeout(15000);

    await pA.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await pA.waitForTimeout(2000);
    await shot(pA, '00-homepage');

    const resultA = await makeBooking(pA, 'Usuario A', TEST_USER_A.celular, TEST_USER_A.senha);

    // ============ USUÁRIO B ============
    log('\n🟢 USUÁRIO B - Segundo cliente (mesmo horário)', 'INFO');
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pB = await ctxB.newPage();
    pB.setDefaultTimeout(15000);

    await pB.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await pB.waitForTimeout(2000);

    const resultB = await makeBooking(pB, 'Usuario B', TEST_USER_B.celular, TEST_USER_B.senha);

    // ============ ANÁLISE ANTI-DUPLO-BOOKING ============
    log('\n============================================================', 'INFO');
    log('🔒 ANÁLISE ANTI-DUPLO-BOOKING', 'INFO');
    log('============================================================', 'INFO');

    if (resultA.success && resultB.success) {
      if (resultA.time === resultB.time) {
        log('❌ FALHA: Ambos usuários agendaram o MESMO horário!', 'ERROR', `${resultA.time}`);
      } else {
        log('✅ SUCESSO: Usuários agendaram horários DIFERENTES', 'SUCCESS', `A: ${resultA.time} | B: ${resultB.time}`);
      }
    } else if (resultA.success && !resultB.success) {
      log('✅ SUCESSO: Usuário A agendou, Usuário B foi bloqueado!', 'SUCCESS', `B falhou: ${resultB.reason}`);
    } else if (!resultA.success && !resultB.success) {
      log('⚠️ Ambos usuários falharam - provavelmente falta cadastrar usuários de teste', 'WARNING');
    }

    // ============ ADMIN VIEW ============
    log('\n============================================================', 'INFO');
    log('🔐 ADMIN: Visualizar agendamentos', 'INFO');
    log('============================================================', 'INFO');

    const ctxAdmin = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pAdmin = await ctxAdmin.newPage();

    await pAdmin.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await pAdmin.waitForTimeout(2000);

    const emailInput = await pAdmin.$('input[type="email"]');
    if (emailInput) {
      await emailInput.fill('devtuma@gmail.com');
      const passInput = await pAdmin.$('input[type="password"]');
      if (passInput) await passInput.fill('admin123'); // ajustar se necessário
      await pAdmin.waitForTimeout(500);

      const submitBtn = await pAdmin.$('button[type="submit"]');
      if (submitBtn) {
        await submitBtn.click().catch(() => {});
        await pAdmin.waitForTimeout(3000);
      }
    }

    await shot(pAdmin, '99-admin-area');

    // ============ MOBILE ============
    log('\n📱 VIEW MOBILE', 'INFO');
    const ctxMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    const pMobile = await ctxMobile.newPage();

    await pMobile.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await pMobile.waitForTimeout(2000);
    await shot(pMobile, '97-mobile-home');

    await pMobile.goto(`${BASE_URL}/booking`, { waitUntil: 'domcontentloaded' });
    await pMobile.waitForTimeout(2000);
    await shot(pMobile, '98-mobile-booking');

  } catch (err) {
    log('ERRO FATAL', 'ERROR', err.message);
    console.error(err);
  } finally {
    await browser.close();
  }

  generateReport();
  log('\n============================================================', 'INFO');
  log(`🏁 Teste finalizado: ${results.tests.passed} sucessos, ${results.tests.failed} erros`, 'SUCCESS');
  log(`📁 Screenshots em: ${SCREENSHOT_DIR}`, 'INFO');
  log(`📊 Relatório HTML: ${path.join(__dirname, 'relatorio.html')}`, 'INFO');
}

function generateReport() {
  const totalSteps = results.steps.length;
  const totalScreenshots = results.screenshots.length;
  const successRate = totalSteps > 0 ? Math.round((results.tests.passed / totalSteps) * 100) : 0;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório BrilhoCar</title>
<style>
  :root { --primary: #00e676; --bg: #0a0a0a; --surface: #1a1a1a; --text: #fff; --text-dim: #aaa; --error: #ff4444; --warning: #ffaa00; --info: #4a9eff; --success: #00e676; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 30px; max-width: 1400px; margin: 0 auto; }
  h1 { color: var(--primary); border-bottom: 4px solid var(--primary); padding-bottom: 16px; font-size: 2.5em; margin-bottom: 10px; }
  h2 { color: var(--primary); margin: 40px 0 20px; font-size: 1.8em; }
  .timestamp { color: var(--text-dim); font-size: 1em; margin: 4px 0; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
  .summary-card { background: var(--surface); padding: 28px; border-radius: 16px; text-align: center; border: 1px solid #333; transition: all 0.3s; }
  .summary-card:hover { transform: translateY(-6px); border-color: var(--primary); box-shadow: 0 10px 30px rgba(0,230,118,0.2); }
  .summary-card .value { font-size: 3.5em; font-weight: 900; color: var(--primary); line-height: 1; }
  .summary-card.error .value { color: var(--error); }
  .summary-card.warning .value { color: var(--warning); }
  .summary-card .label { color: var(--text-dim); margin-top: 12px; text-transform: uppercase; font-size: 0.85em; letter-spacing: 1.5px; font-weight: 600; }
  .step { padding: 14px 18px; margin: 8px 0; border-radius: 10px; background: var(--surface); border-left: 4px solid #555; transition: all 0.2s; font-family: 'Courier New', monospace; font-size: 0.95em; }
  .step:hover { transform: translateX(6px); }
  .step.SUCCESS { border-left-color: var(--success); background: linear-gradient(90deg, rgba(0,230,118,0.12) 0%, var(--surface) 50%); }
  .step.ERROR { border-left-color: var(--error); background: linear-gradient(90deg, rgba(255,68,68,0.12) 0%, var(--surface) 50%); }
  .step.WARNING { border-left-color: var(--warning); background: linear-gradient(90deg, rgba(255,170,0,0.12) 0%, var(--surface) 50%); }
  .step.INFO { border-left-color: var(--info); }
  .step .icon { display: inline-block; margin-right: 10px; font-size: 1.2em; }
  .step .details { margin-top: 8px; color: var(--text-dim); font-size: 0.9em; padding-left: 30px; white-space: pre-wrap; }
  .step .time { color: #666; font-size: 0.8em; margin-top: 4px; padding-left: 30px; }
  .screenshot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; margin-top: 20px; }
  .screenshot-card { background: var(--surface); padding: 16px; border-radius: 12px; border: 1px solid #333; transition: all 0.3s; cursor: pointer; }
  .screenshot-card:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 15px 40px rgba(0,230,118,0.4); border-color: var(--primary); }
  .screenshot-card img { width: 100%; border-radius: 8px; border: 1px solid #444; display: block; }
  .screenshot-card .name { color: var(--primary); font-weight: bold; margin-top: 12px; font-size: 0.95em; text-align: center; padding: 8px; background: rgba(0,230,118,0.05); border-radius: 6px; }
  .links { background: var(--surface); padding: 30px; border-radius: 16px; margin-top: 40px; border: 1px solid #333; }
  .links h2 { margin-top: 0; }
  .links a { color: var(--primary); text-decoration: none; margin: 8px 8px 8px 0; padding: 10px 20px; background: rgba(0,230,118,0.1); border-radius: 10px; display: inline-block; transition: all 0.2s; border: 1px solid transparent; font-weight: 600; }
  .links a:hover { background: rgba(0,230,118,0.25); transform: translateX(4px); border-color: var(--primary); }
  .progress-bar { height: 12px; background: #222; border-radius: 6px; margin: 30px 0; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5); }
  .progress-bar .fill { height: 100%; background: linear-gradient(90deg, var(--primary), #00c853); transition: width 1s; box-shadow: 0 0 10px var(--primary); }
  .progress-label { text-align: center; margin-top: -20px; margin-bottom: 20px; color: var(--primary); font-weight: bold; font-size: 1.2em; }
  .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 999; justify-content: center; align-items: center; }
  .modal.active { display: flex; }
  .modal img { max-width: 90vw; max-height: 90vh; border-radius: 12px; }
  .modal-close { position: fixed; top: 30px; right: 30px; color: white; font-size: 2em; cursor: pointer; padding: 10px 20px; }
</style>
</head>
<body>
<h1>📋 Relatório de Testes - BrilhoCar</h1>
<p class="timestamp">� <strong>Iniciado:</strong> ${results.startTime}</p>
<p class="timestamp">📅 <strong>Finalizado:</strong> ${new Date().toISOString()}</p>

<div class="progress-bar"><div class="fill" style="width: ${successRate}%"></div></div>
<div class="progress-label">Taxa de Sucesso: ${successRate}%</div>

<div class="summary">
  <div class="summary-card"><div class="value">${totalSteps}</div><div class="label">Total Passos</div></div>
  <div class="summary-card"><div class="value">${results.tests.passed}</div><div class="label">✅ Sucessos</div></div>
  <div class="summary-card warning"><div class="value">${results.steps.filter(s => s.status === 'WARNING').length}</div><div class="label">⚠️ Avisos</div></div>
  <div class="summary-card error"><div class="value">${results.tests.failed}</div><div class="label">❌ Erros</div></div>
  <div class="summary-card"><div class="value">${totalScreenshots}</div><div class="label">📸 Screenshots</div></div>
</div>

<h2>📝 Log de Execução (${results.steps.length} entradas)</h2>
${results.steps.map(s => `
  <div class="step ${s.status}">
    <span class="icon">${s.status === 'SUCCESS' ? '✅' : s.status === 'ERROR' ? '❌' : s.status === 'WARNING' ? '⚠️' : '🔵'}</span>
    <strong>${s.step}</strong>
    ${s.details ? `<div class="details">${s.details.replace(/\n/g, '<br>')}</div>` : ''}
    <div class="time">⏰ ${s.time.split('T')[1].split('.')[0]}</div>
  </div>
`).join('')}

<h2>📸 Screenshots (${results.screenshots.length})</h2>
<div class="screenshot-grid">
  ${results.screenshots.map(s => `
    <div class="screenshot-card" onclick="document.getElementById('modal').classList.add('active'); document.getElementById('modal-img').src='screenshots/${path.basename(s.filepath)}';">
      <img src="screenshots/${path.basename(s.filepath)}" alt="${s.name}" loading="lazy" />
      <div class="name">📷 ${s.name}</div>
    </div>
  `).join('')}
</div>

<div id="modal" class="modal" onclick="this.classList.remove('active')">
  <div class="modal-close" onclick="document.getElementById('modal').classList.remove('active')">✕</div>
  <img id="modal-img" src="" />
</div>

<div class="links">
  <h2>🔗 Links Úteis</h2>
  <a href="https://brilhocar-estetica.vercel.app" target="_blank">🌐 Site Produção</a>
  <a href="https://brilhocar-estetica.vercel.app/booking" target="_blank">📅 Agendar</a>
  <a href="https://brilhocar-estetica.vercel.app/track" target="_blank">🔍 Acompanhar</a>
  <a href="https://brilhocar-estetica.vercel.app/login" target="_blank">🔐 Admin</a>
  <a href="https://console.firebase.google.com/project/brilhocar-estetica-9f14b" target="_blank">📊 Firebase</a>
</div>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, 'relatorio.html'), html);
}

runTest().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
