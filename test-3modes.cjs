const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // VIEWPORT MOBILE igual ao seu celular
  const mobileContext = await browser.newContext({
    viewport: { width: 412, height: 915 },  // tamanho típico de celular Android
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const pages = ['/', '/booking'];
  const modes = [
    { name: 'auto', label: 'Tema Automático' },
    { name: 'light', label: 'Tema Claro' },
    { name: 'dark', label: 'Tema Escuro' },
  ];

  for (const path of pages) {
    const pageName = path === '/' ? 'home' : 'booking';
    const page = await mobileContext.newPage();

    for (const mode of modes) {
      console.log(`\n=== ${pageName} - ${mode.name} ===`);
      await page.goto('http://localhost:4176' + path);
      await page.waitForTimeout(1500);

      // Para Booking que redireciona, vamos pegar a URL final
      const finalUrl = page.url();
      console.log('URL final:', finalUrl);

      // Se for booking e redirecionou para login, faz login primeiro
      if (finalUrl.includes('/login') || finalUrl.includes('/client-login')) {
        console.log('Pulando booking (precisa login)');
        continue;
      }

      // Garante que está no modo correto
      await page.evaluate(() => {
        if (typeof localStorage !== 'undefined') {
          if ('${mode.name}' === 'auto') {
            localStorage.removeItem('user-theme-mode');
          } else {
            localStorage.setItem('user-theme-mode', '${mode.name}');
          }
        }
      });
      await page.reload();
      await page.waitForTimeout(1500);

      // Verifica variáveis
      const vars = await page.evaluate(() => ({
        dataTheme: document.documentElement.getAttribute('data-theme'),
        bg: getComputedStyle(document.body).backgroundColor,
        text: getComputedStyle(document.body).color,
        primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
        surface: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim(),
        border: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim(),
      }));
      console.log('Variáveis:', JSON.stringify(vars, null, 2));

      await page.screenshot({
        path: `screenshots/mobile-${pageName}-${mode.name}.png`,
        fullPage: true,
      });
    }

    await page.close();
  }

  await browser.close();
  console.log('\n✅ Concluído!');
})().catch(err => { console.error(err); process.exit(1); });
