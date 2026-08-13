// Teste E2E Admin - BrilhoCar
// Testa painel admin: login → horários → PIX config

import { chromium } from 'playwright';
import fs from 'fs';

const SCREENSHOTS_DIR = 'C:/Users/DevTuma/Documents/Trabalhos/Antigravity/BrilhoCar Estetica Automotiva/test-screenshots-admin';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const BASE_URL = 'https://brilhocar-estetica-9f14b.web.app';
const ADMIN_EMAIL = 'tuma@brilhocar.com.br';
const ADMIN_PASSWORD = 'Tuma@2026';

async function screenshot(page, name) {
  const path = `${SCREENSHOTS_DIR}/${new Date().toISOString().replace(/[:.]/g, '-')}-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 ${name}`);
  return path;
}

async function run() {
  console.log('🚀 Iniciando teste Admin BrilhoCar...\n');

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
    if (msg.text().includes('Error') || msg.text().includes('error')) {
      console.log(`📋 ${msg.text()}`);
    }
  });

  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().includes('hot-update')) {
      console.log(`❌ ${response.status()} ${response.url()}`);
    }
  });

  try {
    // ==================== FASE 1: Login Admin ====================
    console.log('🔐 FASE 1: Login Admin');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    await screenshot(page, '01-admin-login');

    // Preencher credenciais
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.waitForTimeout(300);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.waitForTimeout(300);

    await screenshot(page, '02-admin-login-preenchido');

    // Submit
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
    await screenshot(page, '03-pos-login');

    const urlPosLogin = page.url();
    console.log(`   URL após login: ${urlPosLogin}`);

    // ==================== FASE 2: Painel Admin ====================
    console.log('\n🏠 FASE 2: Painel Admin');
    if (!urlPosLogin.includes('/admin')) {
      await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
    }
    await screenshot(page, '04-admin-dashboard');

    // ==================== FASE 3: Horários ====================
    console.log('\n📅 FASE 3: Configurar Horários');
    await page.goto(`${BASE_URL}/admin/horarios`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await screenshot(page, '05-admin-horarios');

    // Tentar salvar (mesmo sem mudar nada)
    const salvarHorariosBtn = page.locator('button').filter({ hasText: /Salvar Horários/ }).first();
    if (await salvarHorariosBtn.count() > 0) {
      console.log('🖱️ Clicar Salvar Horários');
      await salvarHorariosBtn.click();
      await page.waitForTimeout(3000);
      await screenshot(page, '06-horarios-salvo');
    }

    // ==================== FASE 4: PIX Config ====================
    console.log('\n💰 FASE 4: Configurar PIX');
    await page.goto(`${BASE_URL}/admin/pix`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await screenshot(page, '07-admin-pix');

    // Atualizar valor mínimo para R$ 5
    const minAmountInput = page.locator('input[type="number"]').nth(1);
    if (await minAmountInput.count() > 0) {
      await minAmountInput.fill('5');
      await page.waitForTimeout(500);
      console.log('   Atualizou valor mínimo para R$ 5');
    }

    // Salvar
    const salvarPixBtn = page.locator('button').filter({ hasText: /Salvar/ }).first();
    if (await salvarPixBtn.count() > 0) {
      console.log('🖱️ Clicar Salvar PIX Config');
      await salvarPixBtn.click();
      await page.waitForTimeout(3000);
      await screenshot(page, '08-pix-salvo');
    }

    console.log('\n✅ Teste Admin concluído!');

  } catch (error) {
    console.error('\n💥 ERRO:', error.message);
    await screenshot(page, 'ERRO-final');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
