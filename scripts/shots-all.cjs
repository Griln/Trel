/* Скриншоты всех вкладок для сверки с превью */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts()[0].pages().find((p) => p.url().includes('index.html'));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(6000);
  const names = ['home','browse','installed','worlds','content','modpacks','screenshots','stats','servers','accounts','skin','settings','import','diagnostics'];
  for (const n of names) {
    await page.evaluate((id) => {
      const els = Array.from(document.querySelectorAll('.nav-item, .nav-hero'));
      const map = { home: /Главная|Home/, browse: /Каталог|Browse/, installed: /Установленные|Installed/, worlds: /Миры|Worlds/, content: /Контент|Content/, modpacks: /Модпаки|Modpacks/, screenshots: /Скриншоты|Screenshots/, stats: /Статистика|Stats/, servers: /Серверы|Servers/, accounts: /Аккаунты|Accounts/, skin: /Скин|Skin/, settings: /Настройки|Settings/, import: /Импорт|Import/, diagnostics: /Диагностика|Diagnostics/ };
      const b = els.find((el) => map[id].test(el.textContent));
      if (b) b.click();
    }, n);
    await sleep(1100);
    await page.screenshot({ path: `/tmp/cmp-${n}.png` });
  }
  console.log('shots done');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
