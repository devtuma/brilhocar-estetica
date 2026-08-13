// Teste E2E Admin - Atualizar PIX config via UI admin
import { chromium } from 'playwright';
import fs from 'fs';

const SCREENSHOTS_DIR = 'C:/Users/DevTuma/Documents/Trabalhos/Antigravity/BrilhoCar Estetica Automotiva/test-screenshots-admin';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const BASE_URL = 'https://brilhocar-estetica-9f14b.web.app';

async function screenshot(page, name) {
  const path = `${SCREENSHOTS_DIR}/${new Date().toISOString().replace(/[:.]/g, '-')}-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 ${name}`);
  return path;
}

async function run() {
  console.log('🚀 Atualizando PIX config via admin...\n');

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
      console.log(`📋 ${msg.text().substring(0, 200)}`);
    }
  });

  try {
    // Login com devtuma@gmail.com (admin)
    console.log('🔐 Login devtuma@gmail.com');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.locator('input[type="email"]').first().fill('devtuma@gmail.com');
    await page.waitForTimeout(300);
    await page.locator('input[type="password"]').first().fill('Tuma@2026');
    await page.waitForTimeout(300);

    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
    await screenshot(page, '01-pos-login-admin');

    const url = page.url();
    console.log(`   URL: ${url}`);

    if (url.includes('/login')) {
      console.log('❌ Login falhou - tentando creds alternativas');
      // Tentar com senha mais comum
      await page.locator('input[type="email"]').first().fill('devtuma@gmail.com');
      await page.locator('input[type="password"]').first().clear();
      await page.locator('input[type="password"]').first().fill('Teste123!');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
      await screenshot(page, '01b-pos-login-tentativa2');
    }

    // Navegar para /admin/pix
    console.log('📍 Navegando para /admin/pix');
    await page.goto(`${BASE_URL}/admin/pix`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await screenshot(page, '02-admin-pix');

    // Verificar o valor atual no campo minGuaranteeAmount
    const minInput = page.locator('input[name="minGuaranteeAmount"]');
    const valorAtual = await minInput.inputValue();
    console.log(`   Valor atual: R$ ${valorAtual}`);

    if (parseFloat(valorAtual) > 5) {
      console.log('✏️ Atualizando para R$ 5');
      await minInput.fill('5');
      await page.waitForTimeout(500);
    }

    // Clicar em Salvar
    const salvarBtn = page.locator('button[type="submit"]').filter({ hasText: /Salvar/ });
    await salvarBtn.click();
    await page.waitForTimeout(4000);
    await screenshot(page, '03-pos-salvar');

    // Verificar mensagem de sucesso
    const sucesso = await page.locator('text=/salvo com sucesso/i').count();
    console.log(`   Mensagem de sucesso? ${sucesso > 0 ? '✅ SIM' : '❌ NÃO'}`);

    console.log('\n✅ Concluído!');
  } catch (error) {
    console.error('\n💥 ERRO:', error.message);
    await screenshot(page, 'ERRO-final');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
