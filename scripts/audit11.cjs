/* Search diagnostics: local, data, haystack */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => p.url().includes('index.html')) || ctx.pages()[0];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.nav-item, .nav-hero'));
    const b = els.find((el) => /Каталог|Browse/i.test(el.textContent));
    if (b) b.click();
  });
  await sleep(1200);

  const info = await page.evaluate(() => ({
    htmlLang: document.documentElement.getAttribute('data-theme'),
    bodySample: Array.from(document.querySelectorAll('.v-name')).slice(0, 5).map((e) => e.textContent),
    descSample: Array.from(document.querySelectorAll('.v-desc')).slice(0, 5).map((e) => e.textContent),
    chipSample: Array.from(document.querySelectorAll('.v-item .chip, [class*="chip"]')).slice(0, 5).map((e) => e.textContent),
    inputs: Array.from(document.querySelectorAll('input')).map((i) => i.placeholder || i.type),
  }));
  console.log(JSON.stringify(info, null, 1));

  const input = await page.$('input[placeholder*="оиск"], input[placeholder*="earch"]');
  const count = () => page.$$eval('.v-name', (e) => e.length);
  for (const q of ['1.21', 'snapshot', 'release', 'snapshot 26']) {
    await input.fill(q); await sleep(400);
    console.log(`«${q}» => ${await count()}`);
  }
  await input.fill('');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
