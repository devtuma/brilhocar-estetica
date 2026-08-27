import { chromium } from 'playwright';

const SCREENSHOTS_DIR = 'C:/Users/DevTuma/Documents/Trabalhos/Antigravity/BrilhoCar Estetica Automotiva/screenshots';
const URL = 'http://localhost:4174/';

async function testThemeSwitching() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Listen for console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.log(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  // Listen for page errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  // Listen for request failures
  page.on('requestfailed', request => {
    console.log(`[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`);
  });

  const results = {
    initialDark: {},
    lightState: {},
    finalDark: {}
  };

  try {
    console.log('1. Opening page...');
    await page.goto(URL);
    await page.waitForTimeout(5000); // Wait longer for JS to load

    // Check if root is still empty
    const rootContent = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length || 0);
    console.log(`Root div content length: ${rootContent}`);

    // Check for scripts
    const scripts = await page.$$('script');
    console.log(`Scripts on page: ${scripts.length}`);
    for (const script of scripts) {
      const src = await script.getAttribute('src');
      const type = await script.getAttribute('type');
      console.log(`  Script: src="${src}", type="${type}"`);
    }

    // Check network requests for JS files
    console.log('\nConsole logs:');
    consoleLogs.forEach(log => {
      console.log(`  [${log.type}] ${log.text}`);
    });

    // If root is empty, the app didn't load - check if there's a loading screen or error
    if (rootContent === 0) {
      console.log('\nWARNING: React app did not render! Taking screenshot to see what is displayed...');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/app-state.png`, fullPage: true });

      // Check if there are any visible elements at all
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log(`Body text content: "${bodyText}"`);

      // Check all child elements
      const allElements = await page.evaluate(() => {
        const all = document.querySelectorAll('*');
        return Array.from(all).map(el => ({
          tag: el.tagName,
          id: el.id,
          class: el.className?.substring?.(0, 50),
          visible: el.offsetParent !== null || el.tagName === 'BODY'
        })).slice(0, 20);
      });
      console.log('Elements in DOM:', JSON.stringify(allElements, null, 2));
    }

    // Capture initial state regardless
    console.log('\n2. Capturing initial dark state...');
    results.initialDark = await page.evaluate(() => ({
      bodyBackgroundColor: getComputedStyle(document.body).backgroundColor,
      colorPrimary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
      colorBackground: getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim(),
      dataTheme: document.documentElement.getAttribute('data-theme')
    }));
    console.log('Initial Dark State:', results.initialDark);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/dark-state.png`, fullPage: true });

    // Try to click theme buttons if they exist
    const foundButtons = await page.$$('button');
    console.log(`Found ${foundButtons.length} buttons to try clicking`);

    if (foundButtons.length > 0) {
      // Click light theme button
      console.log('\n3. Clicking Tema Claro button...');
      await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Tema Claro"]');
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);

      results.lightState = await page.evaluate(() => ({
        bodyBackgroundColor: getComputedStyle(document.body).backgroundColor,
        colorPrimary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
        colorBackground: getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim(),
        dataTheme: document.documentElement.getAttribute('data-theme')
      }));
      console.log('Light State:', results.lightState);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/light-state.png`, fullPage: true });

      // Click dark theme button
      console.log('4. Clicking Tema Escuro button...');
      await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Tema Escuro"]');
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);

      results.finalDark = await page.evaluate(() => ({
        bodyBackgroundColor: getComputedStyle(document.body).backgroundColor,
        colorPrimary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
        colorBackground: getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim(),
        dataTheme: document.documentElement.getAttribute('data-theme')
      }));
      console.log('Final Dark State:', results.finalDark);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/dark-state2.png`, fullPage: true });
    } else {
      // No buttons - app didn't load
      console.log('\nAPP DID NOT LOAD - Cannot test theme switching');
      console.log('The React application failed to render on the page.');

      // Copy initial to other states for completeness
      results.lightState = { ...results.initialDark };
      results.finalDark = { ...results.initialDark };
    }

    // Verification
    console.log('\n=== VERIFICATION ===');
    const cssChanged = (results.initialDark.colorPrimary !== results.lightState.colorPrimary) &&
                       (results.lightState.colorPrimary !== results.finalDark.colorPrimary);
    console.log(`CSS Variables changed: ${cssChanged ? 'YES' : 'NO'}`);

    const bgChanged = (results.initialDark.bodyBackgroundColor !== results.lightState.bodyBackgroundColor) ||
                      (results.lightState.bodyBackgroundColor !== results.finalDark.bodyBackgroundColor);
    console.log(`Body background changed: ${bgChanged ? 'YES' : 'NO'}`);

    const dataThemeChanged = (results.initialDark.dataTheme !== results.lightState.dataTheme) &&
                             (results.lightState.dataTheme !== results.finalDark.dataTheme);
    console.log(`data-theme changed: ${dataThemeChanged ? 'YES' : 'NO'}`);

    console.log('\n=== SUMMARY ===');
    console.log(`Initial:  primary=${results.initialDark.colorPrimary}, bg=${results.initialDark.bodyBackgroundColor}, theme=${results.initialDark.dataTheme}`);
    console.log(`Light:    primary=${results.lightState.colorPrimary}, bg=${results.lightState.bodyBackgroundColor}, theme=${results.lightState.dataTheme}`);
    console.log(`Final:    primary=${results.finalDark.colorPrimary}, bg=${results.finalDark.bodyBackgroundColor}, theme=${results.finalDark.dataTheme}`);

    const success = cssChanged && bgChanged && dataThemeChanged;
    console.log(`\nALL TESTS PASSED: ${success ? 'YES' : 'NO'}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testThemeSwitching();
