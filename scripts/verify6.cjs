/* Проверка скролла каталога + повторные скриншоты после правок */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /app:/.test(p.url()));
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.resizeTo(1280, 800));
  await page.waitForTimeout(500);

  // 1) колесо в каталоге
  await page.evaluate(() => { const el = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.trim().startsWith('Каталог')); if (el) el.click(); });
  await page.waitForTimeout(1500);
  const wheel = await page.evaluate(async () => {
    const c = document.querySelector('.content');
    const before = c.scrollTop;
    c.dispatchEvent(new WheelEvent('wheel', { deltaY: 600, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 400));
    return { before, after: c.scrollTop, oy: getComputedStyle(c).overflowY };
  });
  // реальное колесо мыши через CDP
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(500);
  const wheel2 = await page.evaluate(() => document.querySelector('.content').scrollTop);
  console.log('CATALOG SCROLL', JSON.stringify({ ...wheel, cdpWheelTop: wheel2 }));
  await page.screenshot({ path: '/tmp/fix-каталог.png' });

  const shots = [['Серверы', 'серверы'], ['Скин', 'скин'], ['Настройки', 'настройки'], ['Аккаунты', 'аккаунты'], ['Главная', 'главная'], ['Модпаки', 'модпаки'], ['Импорт', 'импорт'], ['Миры', 'миры']];
  for (const [name, slug] of shots) {
    await page.evaluate((n) => { const el = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.trim().startsWith(n)); if (el) el.click(); }, name);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `/tmp/fix-${slug}.png` });
    console.log('shot', slug);
  }
  process.exit(0);
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
