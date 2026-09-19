/* Живая проверка каталога: широкое и узкое окно, текст кнопки, переполнения.
   Все клики — через JS (обход actionability), ресайз — window.resizeTo. */
const { chromium } = require('playwright');

const measure = `(() => {
  const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), w: Math.round(b.width) }; };
  const frame = document.querySelector('.page-frame');
  const toolbar = document.querySelector('.toolbar');
  const content = document.querySelector('.content');
  const vrow = document.querySelector('.vrow');
  const btn = document.querySelector('.vrow .v-actions .btn');
  const date = document.querySelector('.vrow .v-date');
  return {
    innerW: window.innerWidth,
    content: r(content), scrollW: content ? content.scrollWidth : null,
    frame: r(frame), toolbar: r(toolbar),
    tH: toolbar ? Math.round(toolbar.getBoundingClientRect().height) : null,
    vrow: r(vrow), btn: r(btn), btnText: btn ? btn.textContent.trim() : null,
    dateVisible: date ? getComputedStyle(date).display !== 'none' : null,
  };
})()`;

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /app:/.test(p.url()));

  // Интро (если есть) и переход в Каталог — кликами через JS
  for (let i = 0; i < 8; i++) {
    const hasIntro = await page.evaluate(() => document.body.innerText.includes('Добро пожаловать'));
    if (!hasIntro) break;
    await page.evaluate(() => {
      const inp = document.querySelector('input');
      if (inp && !inp.value) {
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        set.call(inp, 'DiagUser');
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btn = [...document.querySelectorAll('button')].find(b => /Продолжить|Далее|Начать|Завершить|Готово|Поехали/.test(b.textContent));
      if (btn) btn.click();
    });
    await page.waitForTimeout(900);
  }
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.sidebar button, .sidebar a, .sidebar [role=button], .sidebar *')].find(e => e.textContent.trim() === 'Каталог');
    if (el) el.click();
  });
  await page.waitForSelector('.vrow', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(500);

  console.log('WIDE  ', JSON.stringify(await page.evaluate(measure)));
  await page.evaluate(() => window.resizeTo(1000, 750));
  await page.waitForTimeout(800);
  console.log('NARROW', JSON.stringify(await page.evaluate(measure)));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
