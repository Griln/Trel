/* Audit v2: all pages + a large snapshot of the new navigation panel */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /app:/.test(p.url()));
  await page.evaluate(() => window.resizeTo(1280, 800));
  await page.waitForTimeout(600);
  const pages = ['Главная', 'Каталог', 'Установленные', 'Серверы', 'Миры', 'Контент', 'Модпаки', 'Скриншоты', 'Статистика', 'Импорт', 'Диагностика', 'Аккаунты', 'Скин', 'Настройки'];
  for (const name of pages) {
    const ok = await page.evaluate((n) => {
      // "Home" is now a hero card, the rest are regular nav-item
      const hero = document.querySelector('.nav-hero');
      if (n === 'Главная' && hero) { hero.click(); return true; }
      const el = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.trim().startsWith(n));
      if (el) { el.click(); return true; }
      return false;
    }, name);
    await page.waitForTimeout(1300);
    const slug = name.toLowerCase();
    await page.screenshot({ path: `/tmp/audit8-${slug}.png` });
    console.log(slug, ok ? 'ok' : 'NAV NOT FOUND');
  }
  // large panel snapshot: active "Home", then active "Browse"
  const shotSidebar = async (tag) => {
    const el = await page.evaluateHandle(() => document.querySelector('.sidebar'));
    await el.asElement().screenshot({ path: `/tmp/audit8-sidebar-${tag}.png` });
  };
  await page.evaluate(() => document.querySelector('.nav-hero').click());
  await page.waitForTimeout(900);
  await shotSidebar('home-active');
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.trim().startsWith('Каталог'));
    if (el) el.click();
  });
  await page.waitForTimeout(900);
  await shotSidebar('browse-active');
  process.exit(0);
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
