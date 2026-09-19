/* Аудит: скриншоты всех страниц для поиска неровностей */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /app:/.test(p.url()));
  await page.evaluate(() => window.resizeTo(1280, 800));
  await page.waitForTimeout(600);
  const pages = ['Главная', 'Каталог', 'Установленные', 'Серверы', 'Миры', 'Контент', 'Модпаки', 'Скриншоты', 'Статистика', 'Импорт', 'Диагностика', 'Аккаунты', 'Скин', 'Настройки'];
  for (const name of pages) {
    const ok = await page.evaluate((n) => {
      const el = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.trim().startsWith(n));
      if (el) { el.click(); return true; }
      return false;
    }, name);
    await page.waitForTimeout(1400);
    const slug = name.toLowerCase();
    await page.screenshot({ path: `/tmp/audit-${slug}.png` });
    console.log(slug, ok ? 'ok' : 'NAV NOT FOUND');
  }
  process.exit(0);
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
