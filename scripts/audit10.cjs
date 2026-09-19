/* Финальная проверка: reveal-полоска возвращает панель; поиск снапшотов */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => p.url().includes('index.html')) || ctx.pages()[0];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // дождаться скрытия
  await page.mouse.move(1100, 500);
  for (let i = 0; i < 8; i++) {
    await sleep(1000);
    if ((await page.$eval('.main', (el) => el.className)).includes('side-hidden')) break;
  }
  console.log('hidden:', (await page.$eval('.main', (el) => el.className)).includes('side-hidden'));
  await page.screenshot({ path: '/tmp/audit9-hidden.png' });

  // наведение на полоску
  await page.mouse.move(3, 300);
  await sleep(900);
  const after = await page.$eval('.main', (el) => el.className);
  console.log('after hover left edge:', after);
  await page.screenshot({ path: '/tmp/audit9-reveal.png' });

  // поиск снапшотов
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.nav-item, .nav-hero'));
    const b = els.find((el) => /Каталог|Browse/i.test(el.textContent));
    if (b) b.click();
  });
  await sleep(1200);
  const input = await page.$('input[placeholder*="оиск"], input[placeholder*="earch"]');
  if (input) {
    const count = () => page.$$eval('.v-name', (e) => e.length);
    await input.fill('снапшот 26'); await sleep(500);
    const a = await count();
    await input.fill('бета'); await sleep(500);
    const b = await count();
    await input.fill('альфа 1.2'); await sleep(500);
    const c = await count();
    await input.fill(''); await sleep(300);
    console.log(`SEARCH2: «снапшот 26»=${a} «бета»=${b} «альфа 1.2»=${c}`);
  }
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
