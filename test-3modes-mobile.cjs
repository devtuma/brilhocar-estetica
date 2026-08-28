const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // Contexto com prefers-color-scheme: dark (sistema escuro)
  const darkContext = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
  });
  // Contexto com prefers-color-scheme: light (sistema claro)
  const lightContext = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  });

  const pages = ['/'];
  const tests = [
    { name: 'auto-dark-sys', context: darkContext, label: 'Auto com SO dark' },
    { name: 'auto-light-sys', context: lightContext, label: 'Auto com SO light' },
    { name: 'force-light', context: darkContext, label: 'Forçar light' },
    { name: 'force-dark', context: lightContext, label: 'Forçar dark' },
  ];

  for (const path of pages) {
    const pageName = path === '/' ? 'home' : 'booking';
    for (const test of tests) {
      const page = await test.context.newPage();
      console.log(`\n=== ${pageName} - ${test.label} ===`);

      await page.goto('http://localhost:4176' + path);
      await page.waitForTimeout(2500);

      // Forçar tema via localStorage antes do reload
      if (test.name.startsWith('force-')) {
        const mode = test.name.split('-')[1];
        await page.evaluate((m) => {
          localStorage.setItem('user-theme-mode', m);
        }, mode);
        await page.reload();
        await page.waitForTimeout(2000);
      }

      const vars = await page.evaluate(() => ({
        dataTheme: document.documentElement.getAttribute('data-theme'),
        bg: getComputedStyle(document.body).backgroundColor,
        text: getComputedStyle(document.body).color,
        prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
        prefersLight: window.matchMedia('(prefers-color-scheme: light)').matches,
        userMode: localStorage.getItem('user-theme-mode'),
      }));
      console.log('Estado:', JSON.stringify(vars, null, 2));

      await page.screenshot({
        path: `screenshots/mobile-${pageName}-${test.name}.png`,
        fullPage: false,
      });
      await page.close();
    }
  }

  await browser.close();
  console.log('\n✅ Concluído!');
})().catch(err => { console.error(err); process.exit(1); });
