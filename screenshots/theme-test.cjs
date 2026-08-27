const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const screenshotDir = 'C:/Users/DevTuma/Documents/Trabalhos/Antigravity/BrilhoCar Estetica Automotiva/screenshots';

  try {
    // Step 1: Navigate
    console.log('Step 1: Navigating to http://localhost:4175/');
    await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' });

    // Step 2: Wait 2 seconds
    console.log('Step 2: Waiting 2 seconds...');
    await page.waitForTimeout(2000);

    // Step 3: Get page snapshot
    console.log('Step 3: Taking page snapshot...');
    const title = await page.title();
    const bodyHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
    console.log('Page Title:', title);
    console.log('Body HTML (first 500 chars):', bodyHTML);

    // Step 4: Evaluate theme variables (BEFORE)
    console.log('\nStep 4: Evaluating theme variables (BEFORE click)...');
    const beforeTheme = await page.evaluate(() => {
      return JSON.stringify({
        dataTheme: document.documentElement.getAttribute('data-theme'),
        bg: getComputedStyle(document.body).backgroundColor,
        primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
        surface: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim(),
        text: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
      });
    });
    console.log('BEFORE:', beforeTheme);

    // Step 5: Take screenshot dark-before.png
    console.log('\nStep 5: Taking screenshot dark-before.png...');
    await page.screenshot({ path: `${screenshotDir}/dark-before.png` });
    console.log('Screenshot saved: dark-before.png');

    // Step 6: Click the theme toggle button (sun button)
    console.log('\nStep 6: Clicking theme toggle button...');
    const themeButton = await page.locator('button[aria-label="Tema Claro"]');
    const buttonExists = await themeButton.count() > 0;
    console.log('Button found:', buttonExists);

    if (buttonExists) {
      await themeButton.click();
      console.log('Button clicked successfully');
    } else {
      // Try alternative selectors
      const altButton = await page.locator('button:has-text("Tema")');
      if (await altButton.count() > 0) {
        await altButton.first().click();
        console.log('Clicked alternative button');
      }
    }

    // Step 7: Wait 1 second
    console.log('\nStep 7: Waiting 1 second...');
    await page.waitForTimeout(1000);

    // Step 8: Evaluate theme variables (AFTER)
    console.log('\nStep 8: Evaluating theme variables (AFTER click)...');
    const afterTheme = await page.evaluate(() => {
      return JSON.stringify({
        dataTheme: document.documentElement.getAttribute('data-theme'),
        bg: getComputedStyle(document.body).backgroundColor,
        primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
        surface: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim(),
        text: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
      });
    });
    console.log('AFTER:', afterTheme);

    // Step 9: Take screenshot light-after.png
    console.log('\nStep 9: Taking screenshot light-after.png...');
    await page.screenshot({ path: `${screenshotDir}/light-after.png` });
    console.log('Screenshot saved: light-after.png');

    // Compare results
    console.log('\n=== RESULTS ===');
    console.log('BEFORE:', beforeTheme);
    console.log('AFTER:', afterTheme);

    const before = JSON.parse(beforeTheme);
    const after = JSON.parse(afterTheme);

    console.log('\n=== CHANGES ===');
    console.log('data-theme changed:', before.dataTheme !== after.dataTheme ? 'YES' : 'NO', `(${before.dataTheme} -> ${after.dataTheme})`);
    console.log('bg changed:', before.bg !== after.bg ? 'YES' : 'NO', `(${before.bg} -> ${after.bg})`);
    console.log('primary changed:', before.primary !== after.primary ? 'YES' : 'NO', `(${before.primary} -> ${after.primary})`);
    console.log('surface changed:', before.surface !== after.surface ? 'YES' : 'NO', `(${before.surface} -> ${after.surface})`);
    console.log('text changed:', before.text !== after.text ? 'YES' : 'NO', `(${before.text} -> ${after.text})`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
