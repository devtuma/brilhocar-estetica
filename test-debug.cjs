const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',  // FORÇAR SO light
  });
  const page = await context.newPage();

  await page.goto('http://localhost:4176/');
  await page.waitForTimeout(2500);

  const result = await page.evaluate(() => ({
    prefersColorScheme: {
      light: window.matchMedia('(prefers-color-scheme: light)').matches,
      dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    },
    dataTheme: document.documentElement.getAttribute('data-theme'),
    localStorageUserMode: localStorage.getItem('user-theme-mode'),
    bg: getComputedStyle(document.body).backgroundColor,
    primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
  }));
  console.log('DEBUG:', JSON.stringify(result, null, 2));

  // Agora simular clique no ThemeToggle
  console.log('\nClicando no botão Tema Claro...');
  await page.click('button[aria-label="Tema Claro"]');
  await page.waitForTimeout(500);

  const afterLight = await page.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute('data-theme'),
    localStorageUserMode: localStorage.getItem('user-theme-mode'),
    bg: getComputedStyle(document.body).backgroundColor,
    primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
  }));
  console.log('APÓS CLICAR LIGHT:', JSON.stringify(afterLight, null, 2));
  await page.screenshot({ path: 'screenshots/debug-after-light.png', fullPage: false });

  // Agora Auto
  console.log('\nClicando no botão Tema Automático...');
  await page.click('button[aria-label="Tema Automático"]');
  await page.waitForTimeout(500);

  const afterAuto = await page.evaluate(() => ({
    dataTheme: document.documentElement.getAttribute('data-theme'),
    localStorageUserMode: localStorage.getItem('user-theme-mode'),
    bg: getComputedStyle(document.body).backgroundColor,
    primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
  }));
  console.log('APÓS CLICAR AUTO:', JSON.stringify(afterAuto, null, 2));
  await page.screenshot({ path: 'screenshots/debug-after-auto.png', fullPage: false });

  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
