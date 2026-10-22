/* Auto-hide probe: is the new markup present and does the timer fire */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => p.url().includes('index.html')) || ctx.pages()[0];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const info = await page.evaluate(() => ({
    hasSideWrap: !!document.querySelector('.side-wrap'),
    hasSideRevealCss: getComputedStyle(document.documentElement).getPropertyValue('--accent') !== '',
    mainClass: document.querySelector('.main')?.className ?? null,
    onboarding: !!document.querySelector('[class*="onboard"]'),
    navCount: document.querySelectorAll('.nav-item, .nav-hero').length,
  }));
  console.log('PROBE:', JSON.stringify(info));

  await page.mouse.move(1100, 500);
  for (let i = 0; i < 8; i++) {
    await sleep(1000);
    const cls = await page.$eval('.main', (el) => el.className).catch(() => 'ERR');
    console.log(`t=${i + 1}s .main="${cls}"`);
    if (cls.includes('side-hidden')) break;
  }
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
