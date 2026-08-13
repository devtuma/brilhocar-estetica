// Teste E2E com Playwright - BrilhoCar PIX
// Testa o fluxo completo: signup → login → agendar → pagamento PIX

import { chromium } from 'playwright';
import fs from 'fs';

const SCREENSHOTS_DIR = 'C:/Users/DevTuma/Documents/Trabalhos/Antigravity/BrilhoCar Estetica Automotiva/test-screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const BASE_URL = 'https://brilhocar-estetica-9f14b.web.app';
const CELULAR = `11${Math.floor(900000000 + Math.random() * 99999999)}`;
const TEST_NAME = 'Teste Automacao E2E';
const TEST_PASSWORD = 'Teste123!';
const FIRMWIDE_PASSWORD = 'Teste123!';

const consoleLogs = [];
const networkErrors = [];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function screenshot(page, name) {
  const path = `${SCREENSHOTS_DIR}/${timestamp()}-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 ${name}`);
  return path;
}

async function run() {
  console.log('🚀 Iniciando teste E2E BrilhoCar PIX...\n');
  console.log(`📱 Celular de teste: ${CELULAR}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'pt-BR',
    timezone: 'America/Sao_Paulo'
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    // Mostrar logs importantes em tempo real
    if (msg.text().includes('TimeSlotPicker') || msg.text().includes('Error') || msg.text().includes('error')) {
      console.log(`   📋 ${msg.text()}`);
    }
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      networkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  page.on('pageerror', (err) => {
    console.log(`💥 Page error: ${err.message}`);
  });

  try {
    // ==================== FASE 1: Homepage ====================
    console.log('📄 FASE 1: Homepage');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await screenshot(page, '01-homepage');

    // ==================== FASE 2: Signup ====================
    console.log('\n📝 FASE 2: Signup');
    await page.goto(`${BASE_URL}/signup`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await screenshot(page, '02-signup');

    // Celular - pegar formato correto
    const celularInputs = page.locator('input[type="tel"]');
    const fmtCel = `(${CELULAR.substring(0, 2)}) ${CELULAR.substring(2, 7)}-${CELULAR.substring(7, 11)}`;
    await celularInputs.nth(0).fill(fmtCel);
    await celularInputs.nth(1).fill(fmtCel);
    await page.waitForTimeout(500);

    // Nome
    await page.locator('input[type="text"]').first().fill(TEST_NAME);
    await page.waitForTimeout(300);

    // Senha - regex: (?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{6,}
    await page.locator('input[type="password"]').nth(0).fill(TEST_PASSWORD);
    await page.locator('input[type="password"]').nth(1).fill(TEST_PASSWORD);
    await page.waitForTimeout(500);

    await screenshot(page, '03-signup-preenchido');

    // Submit cadastro
    console.log('🖱️ Submit cadastro');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(6000);
    await screenshot(page, '04-pos-cadastro');

    // Verificar se houve erro no cadastro
    const urlPosCadastro = page.url();
    const erroCadastro = await page.locator('text=/erro|error/i').count();
    if (urlPosCadastro.includes('/signup') && erroCadastro > 0) {
      const erroMsg = await page.locator('text=/erro|error/i').first().textContent();
      console.log(`⚠️ Cadastro pode ter falhado: ${erroMsg}`);
    }

    // ==================== FASE 3: Booking ====================
    console.log('\n📅 FASE 3: Booking');
    await page.goto(`${BASE_URL}/booking`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await screenshot(page, '05-booking');

    // Selecionar serviço
    console.log('🖱️ Selecionar Lavagem Técnica');
    await page.locator('button').filter({ hasText: 'Lavagem Técnica' }).first().click();
    await page.waitForTimeout(1000);
    await screenshot(page, '06-servico-selecionado');

    // ==================== FASE 4: Cadastrar carro ====================
    console.log('\n🚗 FASE 4: Cadastrar carro');

    // Clicar em "Selecione o carro"
    const selectCarBtn = page.locator('button').filter({ hasText: 'Selecione o carro' }).first();
    await selectCarBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, '07-modal-carro');

    // Clicar em "Cadastrar novo carro"
    const addBtn = page.locator('button').filter({ hasText: 'Cadastrar novo carro' }).first();
    await addBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, '08-carro-form');

    // Preencher modelo - usar o label para ser específico
    const modeloLabel = page.locator('label').filter({ hasText: 'Modelo' });
    const modeloInput = modeloLabel.locator('..').locator('input').first();
    if (await modeloInput.count() > 0) {
      await modeloInput.fill('Civic Teste E2E');
    }
    await page.waitForTimeout(300);

    // Preencher placa - usar o label para ser específico
    const placaLabel = page.locator('label').filter({ hasText: 'Placa' });
    const placaInput = placaLabel.locator('..').locator('input').first();
    if (await placaInput.count() > 0) {
      await placaInput.fill('TEST123');
    }
    await page.waitForTimeout(300);

    await screenshot(page, '08b-carro-preenchido');

    // CLICAR no botão "Salvar" do modal VehiclePicker (não o "Confirmar" do Booking)
    console.log('🖱️ Clicar Salvar (VehiclePicker)');
    const salvarBtn = page.locator('button').filter({ hasText: /^Salvar$/ }).first();
    if (await salvarBtn.count() > 0) {
      await salvarBtn.click();
    } else {
      // Fallback: último botão submit na página (o Salvar do modal)
      const allSubmits = page.locator('button[type="submit"]');
      const count = await allSubmits.count();
      if (count > 1) {
        await allSubmits.last().click();
      }
    }

    // Aguardar o modal reagir (onSelect deve ter sido chamado)
    await page.waitForTimeout(3000);
    await screenshot(page, '09-carro-salvo');

    // Verificar se o modal fechou (carro selecionado) ou ainda está no form
    const modalStillOpen = await page.locator('text="Qual carro?"').count();
    const formStillOpen = await page.locator('text="Modelo"').count();

    if (modalStillOpen > 0 && formStillOpen > 0) {
      // O form ainda está aberto - carro NÃO foi selecionado
      // Pressionar Escape para fechar e tentar novamente
      console.log('⚠️ Modal ainda aberto, fechando...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);

      // Tentar de novo: clicar "Selecione o carro" novamente
      const selectAgain = page.locator('button').filter({ hasText: 'Selecione o carro' }).first();
      if (await selectAgain.count() > 0) {
        await selectAgain.click();
        await page.waitForTimeout(2000);

        // Agora procurar por um carro existente na lista
        const existingCars = page.locator('button').filter({ hasText: /Civic|HB20|Honda|Toyota/i });
        if (await existingCars.count() > 0) {
          console.log('🖱️ Selecionando carro existente da lista');
          await existingCars.first().click();
          await page.waitForTimeout(2000);
        }
      }
    }

    await screenshot(page, '09b-modal-fechado');

    // ==================== FASE 5: Data e Hora ====================
    console.log('\n📅 FASE 5: Data e Hora');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    // Preencher data
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill(dateStr);
    await page.waitForTimeout(2000);
    await screenshot(page, '10-data-preenchida');

    // Clicar no botão de horário para abrir o modal
    const timeBtn = page.locator('button').filter({ hasText: /Selecione o horário|08:00|09:00|10:00/ }).first();
    if (await timeBtn.count() > 0) {
      await timeBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '10b-modal-horario');
    }

    // Selecionar primeiro slot de horário DISPONÍVEL (não disabled)
    // Filtrar apenas botões com horário válido E não desabilitados
    const trySelectSlot = async () => {
      // Re-buscar os slots toda vez (após mudar data)
      const allBtns = page.locator('button');
      const total = await allBtns.count();
      for (let i = 0; i < total; i++) {
        const btn = allBtns.nth(i);
        const text = await btn.textContent();
        const isDisabled = await btn.isDisabled().catch(() => false);
        // Regex para horário tipo 08:00, 09:30 etc
        if (/^\d{2}:\d{2}$/.test(text?.trim() || '') && !isDisabled) {
          console.log(`   🕐 Selecionando horário: ${text.trim()}`);
          await btn.click();
          await page.waitForTimeout(2000);
          return true;
        }
      }
      return false;
    };

    let selected = await trySelectSlot();

    if (!selected) {
      console.log('⚠️ Nenhum slot disponível para a data inicial - pulando dias');
      // Pular dias até encontrar um com slot
      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + dayOffset);
        const dateStr = futureDate.toISOString().split('T')[0];

        await page.locator('input[type="date"]').first().fill(dateStr);
        await page.waitForTimeout(3000); // Aguardar TimeSlotPicker carregar

        selected = await trySelectSlot();
        if (selected) {
          console.log(`   ✅ Horário encontrado para ${dateStr}`);
          break;
        }
      }
    }

    if (!selected) {
      throw new Error('Nenhum horário disponível encontrado em nenhuma data');
    }
    await screenshot(page, '11-horario-selecionado');

    // ==================== FASE 6: Confirmar ====================
    console.log('\n✅ FASE 6: Confirmar agendamento');

    // Verificar se o botão está habilitado
    const confirmarBtn = page.locator('button').filter({ hasText: /Confirmar.*Pagamento|Ir para Pagamento/ }).first();
    const isDisabled = await confirmarBtn.isDisabled({ timeout: 2000 }).catch(() => true);

    if (isDisabled) {
      console.log('⚠️ Botão Confirmar desabilitado - verificando motivo...');
      await screenshot(page, '10c-confirmar-disabled');

      // Verificar qual campo está faltando
      const carSelected = await page.locator('text=/Civic|TEST/i').count();
      const timeSelected = await page.locator('button').filter({ hasText: /^\d{2}:\d{2}$/ }).first().isVisible().catch(() => false);
      console.log(`   Carro selecionado? ${carSelected > 0 ? 'SIM' : 'NÃO'}`);
      console.log(`   Horário selecionado? ${timeSelected ? 'SIM' : 'NÃO'}`);

      // Tentar forçar o preenchimento via JS
      await page.evaluate(() => {
        // Dispara todos os campos required para bypass
        const inputs = document.querySelectorAll('input');
        inputs.forEach(i => {
          if (!i.value && i.type !== 'date') {
            i.dispatchEvent(new Event('input', { bubbles: true }));
            i.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      });

      // Re-checar botão
      const isStillDisabled = await confirmarBtn.isDisabled({ timeout: 2000 }).catch(() => true);
      if (isStillDisabled) {
        console.log('❌ Ainda desabilitado - tentando preencher tudo via JS');
        // Pegar screenshot do estado atual
        await screenshot(page, '10d-debug-state');
      }
    }

    await confirmarBtn.click();
    await page.waitForTimeout(8000);
    await screenshot(page, '12-pos-confirmar');

    const urlAposConfirmar = page.url();
    console.log(`   URL: ${urlAposConfirmar}`);

    // ==================== FASE 7: Verificar PIX ====================
    console.log('\n💳 FASE 7: Verificar PIX');
    await page.waitForTimeout(3000);
    await screenshot(page, '13-pagamento');

    const qrCode = page.locator('img[src*="pix"], svg').first();
    const qrCodeExists = await qrCode.count() > 0;
    console.log(`   QR Code presente? ${qrCodeExists ? '✅ SIM' : '❌ NÃO'}`);

    const copyBtn = page.locator('button').filter({ hasText: /Copiar|PIX|payload/i }).first();
    const hasCopyBtn = await copyBtn.count() > 0;
    console.log(`   Botão PIX? ${hasCopyBtn ? '✅ SIM' : '❌ NÃO'}`);

    // ==================== FASE 8: Resumo ====================
    console.log('\n==================== RESUMO ====================');
    console.log(`📸 Screenshots: ${SCREENSHOTS_DIR}`);
    console.log(`📋 Console logs: ${consoleLogs.length}`);
    console.log(`❌ Network errors: ${networkErrors.length}`);

    if (networkErrors.length > 0) {
      console.log('\n🔴 Erros de rede:');
      networkErrors.slice(0, 10).forEach(e => console.log(`   - ${e}`));
    }

    // Filtrar logs relevantes
    const errosRelevantes = consoleLogs.filter(l =>
      l.includes('error') || l.includes('Error') || l.includes('PIX') || l.includes('Asaas') || l.includes('firebase')
    );
    if (errosRelevantes.length > 0) {
      console.log('\n📋 Logs relevantes:');
      errosRelevantes.slice(0, 10).forEach(l => console.log(`   ${l.substring(0, 200)}`));
    }

    fs.writeFileSync(`${SCREENSHOTS_DIR}/console-logs.txt`, consoleLogs.join('\n'));
    fs.writeFileSync(`${SCREENSHOTS_DIR}/network-errors.txt`, networkErrors.join('\n'));

    console.log('\n✅ Teste concluído!');

  } catch (error) {
    console.error('\n💥 ERRO:', error.message);
    await screenshot(page, 'ERRO-final');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
