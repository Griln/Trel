/* Round 5 finale: search by Russian type names + auto-hide + console errors */
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

  // browse
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.nav-item, .nav-hero'));
    const b = els.find((el) => /Каталог|Browse/i.test(el.textContent));
    if (b) b.click();
  });
  await sleep(1500);
  const input = await page.$('input[placeholder*="оиск"], input[placeholder*="earch"]');
  if (input) {
    const count = () => page.$$eval('.v-name', (e) => e.length);
    // enable the "all" filter if there are chips
    await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.chip, .filter-chip, button'));
      const all = chips.find((c) => /^(все|all)$/i.test((c.textContent || '').trim()));
      if (all) all.click();
    });
    await sleep(500);
    await input.fill('бета'); await sleep(500);
    const a = await count();
    await input.fill('альфа 1.2'); await sleep(500);
    const b = await count();
    await input.fill('патч 26'); await sleep(500);
    const c = await count();
    await input.fill(''); await sleep(300);
    console.log(`SEARCH-RU: «бета»=${a} «альфа 1.2»=${b} «патч 26»=${c}`);
  } else console.log('SEARCH: input NOT FOUND');

  // auto-hide
  await page.mouse.move(1100, 500);
  let hidden = false;
  for (let i = 0; i < 8; i++) {
    await sleep(1000);
    const cls = await page.$eval('.main', (el) => el.className);
    if (cls.includes('side-hidden')) { hidden = true; break; }
  }
  console.log('AUTOHIDE:', hidden ? 'OK (скрылась)' : 'FAIL');
  if (hidden) {
    await page.mouse.move(3, 300);
    await sleep(900);
    const cls = await page.$eval('.main', (el) => el.className);
    console.log('REVEAL:', cls.includes('side-hidden') ? 'FAIL (не вернулась)' : 'OK (вернулась)');
  }

  // sweep all pages for errors
  const n = await page.$$eval('.nav-item, .nav-hero', (els) => els.length);
  for (let i = 0; i < n; i++) {
    const ok = await page.evaluate((idx) => {
      const els = Array.from(document.querySelectorAll('.nav-item, .nav-hero'));
      if (!els[idx]) return false;
      els[idx].click();
      return true;
    }, i);
    if (!ok) break;
    await sleep(600);
  }
  await sleep(800);
  console.log('CONSOLE ERRORS:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
