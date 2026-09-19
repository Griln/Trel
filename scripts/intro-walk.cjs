/* Проходит интро и открывает онбординг, логирует что на экране */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /app:/.test(p.url()));
  const state = () => page.evaluate(() => ({
    intro: document.body.innerText.includes('Добро пожаловать'),
    onb: !!document.querySelector('.onboarding-backdrop'),
    onbPanelCls: document.querySelector('.onboarding-panel')?.className ?? null,
  }));
  console.log('S0', JSON.stringify(await state()));
  for (let i = 0; i < 8; i++) {
    const s = await state();
    if (!s.intro) break;
    await page.evaluate(() => {
      const inp = document.querySelector('input');
      if (inp && !inp.value) {
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        set.call(inp, 'DiagUser'); inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btn = [...document.querySelectorAll('button')].find(b => /Продолжить/.test(b.textContent));
      if (btn) btn.click();
    });
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(2500); // интро-анимация + автопоказ онбординга
  console.log('S1', JSON.stringify(await state()));
  process.exit(0);
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
