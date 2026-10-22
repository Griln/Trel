/* Edge-case audit: empty searches, dialogs, panels */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts()[0].pages().find((p) => p.url().includes('index.html'));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(6000);

  const nav = async (re) => {
    await page.evaluate((src) => {
      const rx = new RegExp(src, 'i');
      const els = Array.from(document.querySelectorAll('.nav-item, .nav-hero'));
      const b = els.find((el) => rx.test(el.textContent));
      if (b) b.click();
    }, re.source);
    await sleep(900);
  };
  const shot = (n) => page.screenshot({ path: `/tmp/st-${n}.png` });

  // Browse: search with no results
  await nav(/Каталог|Browse/);
  const input = await page.$('input[placeholder*="оиск"], input[placeholder*="earch"]');
  await input.fill('xyzxyz'); await sleep(500);
  await shot('browse-noresults');
  await input.fill('1.0'); await sleep(500);
  await shot('browse-10');
  await input.fill(''); await sleep(300);

  // Screenshots: empty search
  await nav(/Скриншоты|Screenshots/);
  const s2 = await page.$('input[placeholder*="оиск"], input[placeholder*="earch"]');
  if (s2) { await s2.fill('xyzxyz'); await sleep(400); }
  await shot('shots-nomatch');

  // Worlds: empty search
  await nav(/Миры|Worlds/);
  const w = await page.$('input[placeholder*="оиск"], input[placeholder*="мира"]');
  if (w) { await w.fill('xyzxyz'); await sleep(400); }
  await shot('worlds-nomatch');

  // Content: open the picker
  await nav(/Контент|Content/);
  await page.evaluate(() => { const b = document.querySelector('.vpick-btn'); if (b) b.click(); });
  await sleep(400);
  await shot('content-vpick');

  // Servers: create dialog
  await nav(/Серверы|Servers/);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => /Новый сервер|Создать/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(500);
  await shot('servers-create');
  await page.keyboard.press('Escape'); await sleep(300);

  // Import: open the category picker
  await nav(/Импорт|Import/);
  await page.evaluate(() => { const b = document.querySelector('.src-go'); if (b) b.click(); });
  await sleep(500);
  await shot('import-select');

  // Settings: danger zone
  await nav(/Настройки|Settings/);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.tab')).find((x) => /Опасная|Danger/i.test(x.textContent));
    if (b) b.click();
  });
  await sleep(400);
  await shot('settings-danger');

  // Home: carousel arrows
  await nav(/Главная|Home/);
  await page.evaluate(() => { const b = document.querySelector('.home-carousel-nav.next'); if (b) b.click(); });
  await sleep(600);
  await shot('home-carousel');

  console.log('state shots done');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
