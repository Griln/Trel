/* Round 5 audit: console errors + browse search + panel auto-hide */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => p.url().includes('index.html')) || ctx.pages()[0];

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Wait for the intro/loading to finish
  await sleep(6000);

  // ---- 1. Search in browse ----
  await page.evaluate(() => {
    // switch page via the sidebar
    const btns = Array.from(document.querySelectorAll('.nav-item, .nav-hero'));
    const b = btns.find((el) => /Каталог|Browse/i.test(el.textContent));
    if (b) b.click();
  });
  await sleep(1500);
  const searchInput = await page.$('.browse-toolbar input, input[placeholder*="оиск"], input[placeholder*="earch"]');
  const rows = async () => page.$$eval('.v-card, .version-card, [class*="v-row"]', (els) => els.length);

  if (searchInput) {
    const count = () => page.$$eval('.v-name', (e) => e.length);
    await searchInput.fill('');
    await sleep(500);
    const all = await count();
    await searchInput.fill('патч');
    await sleep(600);
    const nPatch = await count();
    await searchInput.fill('снапшот 25');
    await sleep(600);
    const nSnap25 = await count();
    await searchInput.fill('релиз');
    await sleep(600);
    const nRelease = await count();
    await searchInput.fill('1.21.4');
    await sleep(600);
    const nId = await count();
    await searchInput.fill('');
    await sleep(400);
    console.log(`SEARCH: total=${all} «патч»=${nPatch} «снапшот 25»=${nSnap25} «релиз»=${nRelease} «1.21.4»=${nId}`);
  } else {
    console.log('SEARCH: input NOT FOUND');
  }

  // ---- 2. Panel auto-hide after 5s ----
  // move the cursor to the right edge so it does not trigger the panel
  await page.mouse.move(900, 400);
  const clsBefore = await page.$eval('.main', (el) => el.className);
  console.log('AUTOHIDE before 6s wait:', clsBefore);
  await sleep(6500);
  const clsAfter = await page.$eval('.main', (el) => el.className);
  console.log('AUTOHIDE after 6s wait:', clsAfter);
  const hidden = clsAfter.includes('side-hidden');

  // hovering over the strip restores the panel
  if (hidden) {
    await page.mouse.move(3, 300);
    await sleep(800);
    const clsReveal = await page.$eval('.main', (el) => el.className);
    console.log('AUTOHIDE after hover left edge:', clsReveal);
    await page.screenshot({ path: '/tmp/audit9-hidden.png' });
  }

  // ---- 3. Sweep all pages, collect errors ----
  const pages = ['home','browse','installed','worlds','content','modpacks','screenshots','stats','servers','accounts','skin','settings','import','diagnostics'];
  for (const name of pages) {
    await page.evaluate((p) => {
      window.dispatchEvent(new CustomEvent('trel-test-nav', { detail: p }));
    }, name);
    await sleep(200);
  }
  // navigation by clicking through the sidebar
  const navCount = await page.$$eval('.nav-item, .nav-hero', (els) => els.length);
  for (let i = 0; i < navCount; i++) {
    const ok = await page.evaluate((idx) => {
      const els = Array.from(document.querySelectorAll('.nav-item, .nav-hero'));
      if (!els[idx]) return false;
      els[idx].click();
      return true;
    }, i);
    if (!ok) break;
    await sleep(700);
    // move the cursor away and wait a bit, the panel must not block clicks
    await page.mouse.move(900, 400);
  }
  await sleep(1000);

  console.log('CONSOLE ERRORS:', errors.length ? errors.join('\n  ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
