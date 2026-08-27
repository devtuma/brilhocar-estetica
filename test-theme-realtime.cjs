const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log('1. Navegando...');
  await page.goto('http://localhost:4175/');
  await page.waitForTimeout(2000);

  const before = await page.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
    surface: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim(),
    text: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
  }));
  console.log('ESTADO 1 (inicial):', JSON.stringify(before, null, 2));
  await page.screenshot({ path: 'screenshots/realtime-dark.png', fullPage: false });

  console.log('\n2. Clicando no botão TEMA CLARO...');
  await page.click('button[aria-label="Tema Claro"]');
  await page.waitForTimeout(800);

  const afterLight = await page.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
    surface: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim(),
    text: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
  }));
  console.log('ESTADO 2 (light):', JSON.stringify(afterLight, null, 2));
  await page.screenshot({ path: 'screenshots/realtime-light.png', fullPage: false });

  console.log('\n3. Clicando no botão TEMA ESCURO...');
  await page.click('button[aria-label="Tema Escuro"]');
  await page.waitForTimeout(800);

  const afterDark = await page.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
    surface: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim(),
    text: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
  }));
  console.log('ESTADO 3 (dark de novo):', JSON.stringify(afterDark, null, 2));
  await page.screenshot({ path: 'screenshots/realtime-dark2.png', fullPage: false });

  console.log('\n=== RESULTADO ===');
  console.log('Tema mudou SEM F5?', before.dataTheme !== afterLight.dataTheme || before.bg !== afterLight.bg);

  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
