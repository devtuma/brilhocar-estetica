const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:4173';
const OUTPUT_DIR = 'C:/Users/DevTuma/Documents/Trabalhos/Antigravity/BrilhoCar Estetica Automotiva/screenshots';

const PAGES = [
  { path: '/', name: 'home.png' },
  { path: '/login', name: 'login.png' },
  { path: '/booking', name: 'booking.png' },
  { path: '/track', name: 'track.png' },
];

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const results = [];

  for (const { path, name } of PAGES) {
    console.log(`\n=== Capturando ${name} ===`);

    try {
      // Navigate to page
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2500); // Extra time for React hydration

      // Check if sun button is active (light mode)
      // Look for the theme toggle button - it should have ☀️ as active when in light mode
      const themeButton = await page.$('button[aria-label*="tema"], button[aria-label*="theme"], button:has-text("☀️"), button:has-text("🌙")');

      let switchedToLight = false;
      if (themeButton) {
        const isLightActive = await page.evaluate((btn) => {
          const button = document.querySelector(`button[aria-label*="tema"], button[aria-label*="theme"], button:has-text("☀️"), button:has-text("🌙")`);
          if (!button) return false;
          // Check if sun button has active state (may have 'data-active', 'aria-pressed', class like 'active', etc.)
          const buttonText = button.textContent;
          // If moon is showing, we need to click to switch to sun/light
          if (buttonText.includes('🌙')) return true; // Already light mode (moon = dark theme)
          if (buttonText.includes('☀️')) return false; // Already light mode
          return false;
        }, themeButton);

        if (isLightActive === false && await page.$('button:has-text("🌙")')) {
          console.log('Dark mode detected, clicking to switch to light mode...');
          await page.click('button:has-text("🌙")');
          await page.waitForTimeout(500);
          switchedToLight = true;
        }
      } else {
        // Alternative: check for data-theme attribute
        const currentTheme = await page.evaluate(() => {
          return document.documentElement.getAttribute('data-theme') ||
                 document.body.getAttribute('data-theme');
        });

        if (currentTheme === 'dark') {
          console.log('Dark mode via data-theme, clicking theme toggle...');
          await page.click('button[aria-label*="tema"], button[aria-label*="theme"], [data-theme-toggle]');
          await page.waitForTimeout(500);
          switchedToLight = true;
        }
      }

      // Take full page screenshot
      const filePath = `${OUTPUT_DIR}/${name}`;
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`Screenshot salvo: ${filePath}`);

      // Analyze the page for dark mode leakage
      const issues = await page.evaluate(() => {
        const problems = [];

        // Check body background
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const bodyBgLower = bodyBg.toLowerCase();
        if (!bodyBgLower.includes('rgb(255') && !bodyBgLower.includes('ffffff') && !bodyBgLower.includes('fafafa') && !bodyBgLower.includes('rgb(250')) {
          problems.push(`Background body não é branco: ${bodyBg}`);
        }

        // Check for dark backgrounds on common elements
        const darkElements = [];
        document.querySelectorAll('div, section, main, article, aside').forEach(el => {
          const bg = window.getComputedStyle(el).backgroundColor;
          const bgLower = bg.toLowerCase();
          if (bgLower.includes('rgb(0') || bgLower.includes('rgb(1') || bgLower.includes('rgb(2') || bgLower.includes('rgb(3') ||
             bgLower.includes('rgb(4') || bgLower.includes('rgb(5') || bgLower.includes('rgb(6') || bgLower.includes('rgb(7') ||
             bgLower.includes('rgb(8') || bgLower.includes('rgb(9') || bgLower.includes('rgb(10') || bgLower.includes('rgb(11') ||
             bgLower.includes('rgb(12') || bgLower.includes('rgb(13') || bgLower.includes('rgb(14') || bgLower.includes('rgb(15') ||
             bgLower.includes('rgb(16') || bgLower.includes('rgb(17') || bgLower.includes('rgb(18') || bgLower.includes('rgb(19') ||
             bgLower.includes('rgb(20') || bgLower.includes('rgb(2') && !bgLower.includes('rgb(25')) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 50) {
              darkElements.push({ tag: el.tagName, bg, rect: { w: Math.round(rect.width), h: Math.round(rect.height) } });
            }
          }
        });

        if (darkElements.length > 0) {
          problems.push(`Elementos com fundo escuro detectados: ${JSON.stringify(darkElements.slice(0, 3))}`);
        }

        // Check for white text on dark backgrounds (illegible)
        document.querySelectorAll('*').forEach(el => {
          const color = window.getComputedStyle(el).color;
          const bg = window.getComputedStyle(el.parentElement || el).backgroundColor;
          if (color.toLowerCase().includes('rgb(255') && bg.toLowerCase().includes('rgb(0') && el.textContent.trim()) {
            problems.push(`Texto branco possivelmente ilegível: "${el.textContent.trim().substring(0, 50)}"`);
          }
        });

        // Check inputs
        document.querySelectorAll('input, textarea, select').forEach(input => {
          const bg = window.getComputedStyle(input).backgroundColor;
          if (bg.toLowerCase().includes('rgb(0') || bg.toLowerCase().includes('rgb(1') || bg.toLowerCase().includes('rgb(2')) {
            problems.push(`Input com fundo escuro: ${bg}`);
          }
          const border = window.getComputedStyle(input).borderColor;
          if (border.toLowerCase().includes('rgb(0') && window.getComputedStyle(input.parentElement || input).backgroundColor.toLowerCase().includes('rgb(255')) {
            problems.push(`Input com borda escura: ${border}`);
          }
        });

        // Check buttons
        document.querySelectorAll('button').forEach(btn => {
          const bg = window.getComputedStyle(btn).backgroundColor;
          const color = window.getComputedStyle(btn).color;
          // Dark bg with light text is OK, but dark bg with dark text is not
          if ((bg.toLowerCase().includes('rgb(0') || bg.toLowerCase().includes('rgb(1')) && color.toLowerCase().includes('rgb(0')) {
            problems.push(`Botão com fundo e texto escuro: bg=${bg}, color=${color}`);
          }
        });

        return problems;
      });

      results.push({
        name,
        path,
        filePath,
        switchedToLight,
        issues,
        status: 'success'
      });

    } catch (error) {
      console.error(`Erro ao capturar ${name}:`, error.message);
      results.push({
        name,
        path,
        status: 'error',
        error: error.message
      });
    }
  }

  await browser.close();

  // Print summary
  console.log('\n\n========================================');
  console.log('           RESUMO DOS RESULTADOS');
  console.log('========================================\n');

  for (const r of results) {
    console.log(`\n[${r.status.toUpperCase()}] ${r.name}`);
    console.log(`  URL: ${r.path}`);
    if (r.filePath) console.log(`  Arquivo: ${r.filePath}`);
    if (r.switchedToLight) console.log('  Nota: Modo claro ativado');
    if (r.issues && r.issues.length > 0) {
      console.log('  Problemas encontrados:');
      r.issues.forEach(issue => console.log(`    - ${issue}`));
    } else if (r.status === 'success') {
      console.log('  Sem problemas visuais óbvios');
    }
    if (r.error) console.log(`  Erro: ${r.error}`);
  }

  return results;
}

captureScreenshots().catch(console.error);
