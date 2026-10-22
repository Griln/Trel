/* Second verification wave: tour (restart), accounts, servers, diagnostics, skin */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /app:/.test(p.url()));
  const sleep = (ms) => page.waitForTimeout(ms);
  const shot = (n) => page.screenshot({ path: `/tmp/trel-${n}.png` }).then(() => console.log('shot ->', `/tmp/trel-${n}.png`));
  const nav = (re) => page.evaluate((src) => {
    const el = [...document.querySelectorAll('.nav-item')].find(x => new RegExp(src).test(x.textContent));
    if (el) el.click();
    return !!el;
  }, re.source);

  // ── B. tour: reset seen and reload — the tour must open automatically ──
  await page.evaluate(() => { localStorage.removeItem('trel:onboarding-seen:v2'); });
  await page.reload({ waitUntil: 'load' });
  // wait up to 20s for the tour to show up on its own (intro + minimal loading)
  let onb = null;
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    onb = await page.evaluate(() => ({
      onb: !!document.querySelector('.onboarding-backdrop'),
      closeBtn: !!document.querySelector('.onboarding-close'),
      closeStyle: (() => { const el = document.querySelector('.onboarding-close'); if (!el) return null; const cs = getComputedStyle(el); return { w: cs.width, br: cs.borderRadius, bg: cs.backgroundColor }; })(),
      tip: document.querySelector('.onboarding-tip span')?.textContent ?? null,
    }));
    if (onb.onb) break;
  }
  console.log('B tour after reload:', JSON.stringify(onb));
  await shot('tour-v2');
  // close it with the nice little cross
  await page.evaluate(() => { const x = document.querySelector('.onboarding-close'); if (x) x.click(); });
  await sleep(600);
  console.log('B2 closed:', JSON.stringify(await page.evaluate(() => ({
    onb: !!document.querySelector('.onboarding-backdrop'),
    seen: localStorage.getItem('trel:onboarding-seen:v2'),
  }))));

  // ── D. accounts in a narrow window ──
  await nav(/Аккаунты/);
  await sleep(1000);
  await page.evaluate(() => window.resizeTo(900, 700));
  await sleep(700);
  const acc = await page.evaluate(() => {
    const card = document.querySelector('.acc');
    const sub = document.querySelector('.acc-sub');
    return {
      bodyScrollW: document.body.scrollWidth,
      winW: window.innerWidth,
      cardW: card ? Math.round(card.getBoundingClientRect().width) : null,
      cardRight: card ? Math.round(card.getBoundingClientRect().right) : null,
      subText: sub ? sub.textContent : null,
      subOverflow: sub ? [...sub.children].some(s => s.scrollWidth > s.clientWidth + 2) : null,
    };
  });
  console.log('D accounts narrow:', JSON.stringify(acc));
  await shot('accounts-narrow');

  // ── E. servers: modal ──
  await page.evaluate(() => window.resizeTo(1280, 800));
  await sleep(400);
  console.log('E nav servers:', await nav(/Серверы/));
  await sleep(1000);
  await page.evaluate(() => {
    const b = document.querySelector('.srv-add') || [...document.querySelectorAll('button')].find(x => /Новый сервер/.test(x.textContent));
    if (b) b.click();
  });
  await sleep(1200);
  const srv = await page.evaluate(() => ({
    backdrop: !!document.querySelector('.srv-create-backdrop'),
    modal: !!document.querySelector('.srv-create'),
    vpick: !!document.querySelector('.srv-create .vpick-btn'),
    chips: [...document.querySelectorAll('.mchip')].map(m => m.textContent),
    oldSelect: !!document.querySelector('.srv-create select'),
    pos: (() => { const el = document.querySelector('.srv-create-backdrop'); return el ? getComputedStyle(el).position : null; })(),
    vpickLabel: document.querySelector('.srv-create .vpick-info b')?.textContent ?? null,
  }));
  console.log('E server modal:', JSON.stringify(srv));
  await shot('server-modal');
  await page.evaluate(() => { const b = document.querySelector('.srv-create .vpick-btn'); if (b) b.click(); });
  await sleep(500);
  await shot('server-modal-open');
  await page.keyboard.press('Escape');
  await sleep(500);
  console.log('E2 after Esc:', JSON.stringify(await page.evaluate(() => ({ backdrop: !!document.querySelector('.srv-create-backdrop') }))));

  // ── F. diagnostics ──
  console.log('F nav diag:', await nav(/Диагностика/));
  await sleep(1000);
  const diag = await page.evaluate(() => ({
    vpick: document.querySelectorAll('.vpick-btn').length,
    oldSelects: document.querySelectorAll('select.select').length,
  }));
  console.log('F diagnostics:', JSON.stringify(diag));
  await shot('diagnostics');

  // ── G. skin: account picker ──
  console.log('G nav skin:', await nav(/Скин/));
  await sleep(1200);
  const skin = await page.evaluate(() => ({
    vpick: document.querySelectorAll('.vpick-btn').length,
    oldSelects: document.querySelectorAll('select.select').length,
  }));
  console.log('G skin page:', JSON.stringify(skin));

  process.exit(0);
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
