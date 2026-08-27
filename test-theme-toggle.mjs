import { chromium } from 'playwright';

const screenshotPath = 'C:/Users/DevTuma/Documents/Trabalhos/Antigravity/BrilhoCar Estetica Automotiva/screenshots/light-home.png';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('1. Abrindo http://localhost:4173/...');
  await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Clicar no botão Claro
  const claroBtn = page.locator('[aria-label="Claro"]').first();
  console.log('2. Clicando no botão Claro (toggle de tema)...');
  await claroBtn.click();

  console.log('3. Aguardando 1 segundo...');
  await page.waitForTimeout(1000);

  console.log('4. Capturando screenshot...');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`   Screenshot salvo em: ${screenshotPath}`);

  // ANÁLISE PROFUNDA
  console.log('\n=== ANÁLISE DETALHADA DO LIGHT MODE ===\n');

  // 1. Body
  const bodyBg = await page.evaluate(() => {
    const body = document.body;
    const style = window.getComputedStyle(body);
    return { bg: style.backgroundColor, color: style.color };
  });
  console.log(`[1] BODY`);
  console.log(`    Background: ${bodyBg.bg} ${bodyBg.bg === 'rgb(255, 255, 255)' ? '✓' : '✗ DEVERIA SER #FFFFFF'}`);
  console.log(`    Color: ${bodyBg.color}`);

  // 2. Header
  const header = await page.evaluate(() => {
    const h = document.querySelector('header');
    if (!h) return null;
    const style = window.getComputedStyle(h);
    return {
      bg: style.backgroundColor,
      backdrop: style.backdropFilter,
      border: style.borderBottom,
      position: style.position
    };
  });
  console.log(`\n[2] HEADER`);
  if (header) {
    console.log(`    Background: ${header.bg}`);
    console.log(`    Backdrop-filter: ${header.backdrop}`);
    const hasGlass = header.backdrop !== 'none' && header.backdrop !== '';
    console.log(`    Glassmorphism: ${hasGlass ? '✓ PRESENTE' : '✗ AUSENTE'}`);
  }

  // 3. Hero Section
  const hero = await page.evaluate(() => {
    // Procurar hero por classe ou primeira section
    const heroEl = document.querySelector('[class*="hero"], .hero, section:first-of-type, main section:first-of-type');
    if (!heroEl) return null;
    const style = window.getComputedStyle(heroEl);
    return {
      bg: style.backgroundColor,
      bgImage: style.backgroundImage,
      tag: heroEl.tagName,
      className: heroEl.className.substring(0, 60)
    };
  });
  console.log(`\n[3] HERO SECTION`);
  if (hero) {
    console.log(`    Background: ${hero.bg}`);
    console.log(`    Background-image: ${hero.bgImage.substring(0, 50)}...`);
    console.log(`    Tag: ${hero.tag}`);
    console.log(`    Class: ${hero.className}`);

    // Verificar se tem cor escura queimada
    if (hero.bg.includes('50, 50') || hero.bg.includes('0, 0, 0') || hero.bg.includes('0 0 0')) {
      console.log(`    ✗ PROBLEMA: Fundo escuro/queimado detectado`);
    }
  }

  // 4. Cards de Serviço
  const cards = await page.evaluate(() => {
    // Procurar por múltiplos seletores de cards
    const selectors = [
      '[class*="card"]',
      '[class*="service-card"]',
      '[class*="service-card"]',
      '.bg-white',
      'section > div > div'
    ];

    let foundCards = [];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        els.forEach(el => {
          const style = window.getComputedStyle(el);
          const hasShadow = style.boxShadow !== 'none' && style.boxShadow !== '';
          const bg = style.backgroundColor;
          const isCard = hasShadow || bg === 'rgb(255, 255, 255)' || el.className.includes('card');

          if (isCard && foundCards.length < 10) {
            foundCards.push({
              class: el.className.substring(0, 50),
              bg: bg,
              shadow: style.boxShadow.substring(0, 60),
              tag: el.tagName
            });
          }
        });
      }
    }
    return foundCards;
  });
  console.log(`\n[4] CARDS DE SERVIÇO`);
  console.log(`    Encontrados: ${cards.length}`);
  cards.slice(0, 5).forEach((card, i) => {
    const isWhite = card.bg === 'rgb(255, 255, 255)';
    const hasShadow = card.shadow !== 'none' && card.shadow !== '';
    console.log(`    Card ${i + 1}: bg=${card.bg} ${isWhite ? '✓' : '✗'} | shadow=${hasShadow ? '✓' : '✗'}`);
  });

  // 5. Botões Primários
  const buttons = await page.evaluate(() => {
    // Primeiro, todos os botões
    const allBtns = Array.from(document.querySelectorAll('button, [class*="btn"], a[class*="btn"]'));

    return allBtns.slice(0, 15).map(btn => {
      const style = window.getComputedStyle(btn);
      return {
        text: btn.textContent?.trim().substring(0, 30),
        class: btn.className.substring(0, 50),
        bg: style.backgroundColor,
        color: style.color,
        tag: btn.tagName
      };
    });
  });

  console.log(`\n[5] BOTÕES`);
  console.log(`    Total encontrado: ${buttons.length}`);

  const blueButtons = buttons.filter(b => b.bg.includes('0, 122, 255') || b.bg.includes('0 122 255'));
  const primaryBtn = buttons.find(b => b.class.includes('primary') || b.class.includes('cta'));

  console.log(`    Botões azuis Apple (#007AFF): ${blueButtons.length}`);
  if (primaryBtn) {
    console.log(`    Botão primário: bg=${primaryBtn.bg}, color=${primaryBtn.color}`);
  }

  // Mostrar todos os botões com suas cores
  console.log(`\n    Todos os botões:`);
  buttons.slice(0, 8).forEach((btn, i) => {
    const isBlue = btn.bg.includes('0, 122, 255') || btn.bg.includes('0 122 255');
    console.log(`      ${i + 1}. "${btn.text}" | bg=${btn.bg} ${isBlue ? '✓' : ''}`);
  });

  // 6. TODAS as cores presentes na página
  const allColors = await page.evaluate(() => {
    const colors = {
      backgrounds: new Map(),
      textColors: new Map()
    };

    document.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;
      const color = style.color;

      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        if (!colors.backgrounds.has(bg)) colors.backgrounds.set(bg, 0);
        colors.backgrounds.set(bg, colors.backgrounds.get(bg) + 1);
      }

      if (color && color !== 'rgba(0, 0, 0, 0)') {
        if (!colors.textColors.has(color)) colors.textColors.set(color, 0);
        colors.textColors.set(color, colors.textColors.get(color) + 1);
      }
    });

    return {
      backgrounds: Array.from(colors.backgrounds.entries())
        .filter(([_, c]) => c > 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20),
      textColors: Array.from(colors.textColors.entries())
        .filter(([_, c]) => c > 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
    };
  });

  console.log(`\n[6] PALETA DE CORES DETECTADA`);
  console.log(`\n    Backgrounds (${allColors.backgrounds.length}):`);
  allColors.backgrounds.forEach(([color, count]) => {
    const isDark = color.includes('0, 0, 0') || color.includes('0 0 0') || color.includes('50, 50');
    const isWhite = color.includes('255, 255, 255');
    console.log(`      ${color} (${count}) ${isDark ? '⚠️ ESCURO' : isWhite ? '✓ BRANCO' : ''}`);
  });

  console.log(`\n    Cores de texto (${allColors.textColors.length}):`);
  allColors.textColors.forEach(([color, count]) => {
    const isDark = color.includes('0, 0, 0') || color.includes('10, 10');
    console.log(`      ${color} (${count}) ${isDark ? '✓ TEXTO ESCURO' : ''}`);
  });

  // 7. Análise de contraste detalhada
  const contrast = await page.evaluate(() => {
    const issues = [];

    const getLuminance = (rgb) => {
      const match = rgb.match(/\d+/g);
      if (!match || match.length < 3) return 0;
      const [r, g, b] = match.map(Number);
      const toLinear = (c) => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };

    // Verificar principais elementos
    const elements = document.querySelectorAll('h1, h2, h3, h4, p, a, button, span, li');
    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;
      const color = style.color;
      const text = el.textContent?.trim();

      if (bg && color && text && text.length > 0 && text.length < 100) {
        if (bg !== 'rgba(0, 0, 0, 0)' && color !== 'rgba(0, 0, 0, 0)') {
          const bgLum = getLuminance(bg);
          const textLum = getLuminance(color);
          const contrast = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05);

          if (contrast < 4.5) {
            issues.push({
              text: text.substring(0, 50),
              color,
              bg,
              ratio: contrast.toFixed(2)
            });
          }
        }
      }
    });

    return issues;
  });

  console.log(`\n[7] PROBLEMAS DE CONTRASTE (< 4.5:1)`);
  if (contrast.length === 0) {
    console.log(`    ✓ Nenhum problema de contraste encontrado`);
  } else {
    contrast.slice(0, 15).forEach((issue, i) => {
      console.log(`    ${i + 1}. "${issue.text}"...`);
      console.log(`       Cor: ${issue.color} | BG: ${issue.bg} | Ratio: ${issue.ratio}:1`);
    });
  }

  // 8. Verificar elementos com cores específicas problemáticas
  const problematicElements = await page.evaluate(() => {
    const issues = [];

    // Procurar por backgrounds verdes escuros (sintoma de dark mode não trocado)
    const darkGreen = ['50, 50', '0, 0, 0', '30, 30', 'rgb(50', 'rgb(0, 0, 0)'];

    document.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;

      if (bg && bg !== 'rgba(0, 0, 0, 0)') {
        // Background muito escuro para light mode
        const match = bg.match(/rgb\((\d+)/);
        if (match) {
          const val = parseInt(match[1]);
          if (val < 50 && !bg.includes('255, 255')) {
            issues.push({
              type: 'dark_background',
              bg,
              class: el.className.substring(0, 40),
              tag: el.tagName
            });
          }
        }
      }
    });

    return issues;
  });

  console.log(`\n[8] ELEMENTOS COM FUNDO MUITO ESCURO`);
  if (problematicElements.length === 0) {
    console.log(`    ✓ Nenhum fundo excessivamente escuro encontrado`);
  } else {
    problematicElements.slice(0, 10).forEach((el, i) => {
      console.log(`    ${i + 1}. [${el.tag}] bg=${el.bg} | class="${el.class}"`);
    });
  }

  await browser.close();

  console.log('\n=== FIM DA ANÁLISE ===');
  console.log(`\nScreenshot: ${screenshotPath}`);
}

main().catch(e => {
  console.error('Erro:', e.message);
  process.exit(1);
});
