/* State screenshots via CDP: usage: node scripts/shot-cdp.cjs <name> */
const { chromium } = require('playwright');
(async () => {
  const name = process.argv[2] || 'shot';
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => /app:/.test(p.url()));
  await page.screenshot({ path: `/tmp/trel-${name}.png` });
  console.log('saved /tmp/trel-' + name + '.png');
  process.exit(0);
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
