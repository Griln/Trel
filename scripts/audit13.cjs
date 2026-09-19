/* Проверка раунда 6: поиск 1.0, авто-перевыбор, «нет версий», панель */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => p.url().includes('index.html')) || ctx.pages()[0];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await sleep(5000);

  // --- каталог: поиск 1.0 и авто-перевыбор ---
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.nav-item, .nav-hero'));
    const b = els.find((el) => /Каталог|Browse/i.test(el.textContent));
    if (b) b.click();
  });
  await sleep(1500);
  const input = await page.$('input[placeholder*="оиск"], input[placeholder*="earch"]');
  const count = () => page.$$eval('.vrow', (e) => e.length);
  await input.fill('1.0'); await sleep(500);
  const n10 = await count();
  const aboutId = await page.evaluate(() => document.querySelector('.about-id')?.textContent ?? '(нет)');
  const headId = await page.evaluate(() => document.querySelector('.section-head h3')?.textContent ?? '(нет)');
  console.log(`SEARCH «1.0»: rows=${n10} about=${aboutId} head=${headId}`);
  await input.fill('1.21.11'); await sleep(500);
  const n121 = await count();
  const about2 = await page.evaluate(() => document.querySelector('.about-id')?.textContent ?? '(нет)');
  console.log(`SEARCH «1.21.11»: rows=${n121} about=${about2}`);
  await input.fill(''); await sleep(400);

  // --- панель: группы ---
  const groups = await page.$$eval('.nav-group-label', (els) => els.map((e) => e.textContent));
  console.log('SIDEBAR GROUPS:', groups.join(' | '));
  await page.screenshot({ path: '/tmp/round6-sidebar.png' });

  // --- контент: «нет версий» ---
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.nav-item, .nav-hero'));
    const b = els.find((el) => /Контент|Content/i.test(el.textContent));
    if (b) b.click();
  });
  await sleep(1200);
  const vpickName = await page.evaluate(() => document.querySelector('#vpickName')?.textContent ?? '(нет)');
  console.log('CONTENT VPICK:', vpickName);

  // --- диагностика ---
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.nav-item, .nav-hero'));
    const b = els.find((el) => /Диагностика|Diagnostics/i.test(el.textContent));
    if (b) b.click();
  });
  await sleep(1000);
  const diagPick = await page.evaluate(() => document.querySelector('.vpick-info b')?.textContent ?? '(нет)');
  console.log('DIAG VPICK:', diagPick);

  console.log('CONSOLE ERRORS:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
