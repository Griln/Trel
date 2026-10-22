/* Comprehensive check of 5 fixes on the live build via CDP */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /app:/.test(p.url()));
  if (!page) throw new Error('no app page');
  const sleep = (ms) => page.waitForTimeout(ms);
  const shot = (n) => page.screenshot({ path: `/tmp/trel-${n}.png` }).then(() => console.log('shot ->', `/tmp/trel-${n}.png`));

  // ── A. intro + welcome (new xdg3 profile): click through ──
  for (let i = 0; i < 20; i++) {
    const done = await page.evaluate(() => {
      // if there is an intro overlay without any form — click its buttons
      const inp = document.querySelector('input');
      if (inp && !inp.value) {
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        set.call(inp, 'VerifyUser'); inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btn = [...document.querySelectorAll('button')].find(b => /Продолжить|Начать/.test(b.textContent));
      if (btn && !btn.disabled) { btn.click(); return false; }
      return !!document.querySelector('.sidebar');
    });
    if (done) break;
    await sleep(1000);
  }
  await sleep(3000);

  // ── B. the tour must open automatically AFTER the account is created ──
  const onb1 = await page.evaluate(() => ({
    onb: !!document.querySelector('.onboarding-backdrop'),
    closeBtn: !!document.querySelector('.onboarding-close'),
    closeStyle: (() => { const el = document.querySelector('.onboarding-close'); if (!el) return null; const cs = getComputedStyle(el); return { w: cs.width, br: cs.borderRadius }; })(),
    tipText: document.querySelector('.onboarding-tip span')?.textContent ?? null,
  }));
  console.log('B onboarding:', JSON.stringify(onb1));
  await shot('onboarding');

  // click on the step navigation button — it must now really lead to the page
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.onboarding-action-buttons .btn')];
    const nav = btns.find(b => !/Дальше|Назад|Назад/.test(b.textContent) && b.classList.contains('ghost'));
    if (nav) nav.click();
  });
  await sleep(800);
  const onb2 = await page.evaluate(() => ({
    onb: !!document.querySelector('.onboarding-backdrop'),
    sidebar: !!document.querySelector('.sidebar'),
  }));
  console.log('B2 after nav click:', JSON.stringify(onb2));

  // ── C. browse: colored chips + multi-select ──
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.sidebar button, .sidebar a, .side-item, button')].find(x => /Каталог/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(1200);
  const cat1 = await page.evaluate(() => ({
    chips: [...document.querySelectorAll('.ftype')].map(f => ({ cls: f.className, txt: f.textContent.trim().slice(0, 20) })),
    vcount: document.querySelector('.vcount')?.textContent ?? null,
  }));
  console.log('C1 chips:', JSON.stringify(cat1.chips));
  // multi-select: add a snapshot to the release
  await page.evaluate(() => {
    const f = [...document.querySelectorAll('.ftype')].find(x => /Снапшот|snapshot/i.test(x.textContent));
    if (f) f.click();
  });
  await sleep(600);
  const cat2 = await page.evaluate(() => ({
    on: [...document.querySelectorAll('.ftype.on')].map(f => f.className),
    vcount: document.querySelector('.vcount')?.textContent ?? null,
    colors: [...document.querySelectorAll('.ftype')].map(f => getComputedStyle(f).color),
  }));
  console.log('C2 multi-select on:', JSON.stringify(cat2.on));
  console.log('C2 vcount:', cat2.vcount);
  console.log('C2 colors:', JSON.stringify(cat2.colors));
  await shot('catalog-filters');

  // ── D. accounts: narrow window, no overflow, normal skin text ──
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /Аккаунты/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(900);
  await page.evaluate(() => window.resizeTo(900, 700));
  await sleep(700);
  const acc = await page.evaluate(() => {
    const frame = document.querySelector('.page-frame') || document.querySelector('.content');
    const card = document.querySelector('.acc');
    const sub = document.querySelector('.acc-sub');
    return {
      bodyScrollW: document.body.scrollWidth,
      winW: window.innerWidth,
      cardW: card ? card.getBoundingClientRect().width : null,
      cardRight: card ? card.getBoundingClientRect().right : null,
      subText: sub ? sub.textContent : null,
      hasUnbreakable: sub ? [...sub.children].some(s => s.scrollWidth > s.clientWidth + 2) : null,
    };
  });
  console.log('D accounts narrow:', JSON.stringify(acc));
  await shot('accounts-narrow');

  // ── E. servers: create modal ──
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /Серверы/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(1000);
  await page.evaluate(() => {
    const b = document.querySelector('.srv-add') || [...document.querySelectorAll('button')].find(x => /Новый сервер|Создать/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(900);
  const srv = await page.evaluate(() => ({
    backdrop: !!document.querySelector('.srv-create-backdrop'),
    modal: !!document.querySelector('.srv-create'),
    vpick: !!document.querySelector('.srv-create .vpick-btn'),
    chips: [...document.querySelectorAll('.mchip')].map(m => m.textContent),
    oldSelect: !!document.querySelector('.srv-create select'),
    backdropStyle: (() => { const el = document.querySelector('.srv-create-backdrop'); return el ? getComputedStyle(el).position : null; })(),
  }));
  console.log('E server modal:', JSON.stringify(srv));
  await shot('server-modal');
  // open the version picker for the shot
  await page.evaluate(() => { const b = document.querySelector('.srv-create .vpick-btn'); if (b) b.click(); });
  await sleep(500);
  await shot('server-modal-open');
  // close with Esc
  await page.keyboard.press('Escape');
  await sleep(500);
  const srv2 = await page.evaluate(() => ({ backdrop: !!document.querySelector('.srv-create-backdrop') }));
  console.log('E2 after Esc:', JSON.stringify(srv2));

  // ── F. diagnostics: vpick instead of select ──
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /Диагностика/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(1000);
  const diag = await page.evaluate(() => ({
    vpick: !!document.querySelector('.vpick-btn'),
    oldSelects: document.querySelectorAll('select.select').length,
  }));
  console.log('F diagnostics:', JSON.stringify(diag));
  await shot('diagnostics');

  process.exit(0);
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
