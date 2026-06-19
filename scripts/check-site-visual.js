const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sitePath = path.join(root, '_backup_moved_site', 'site_20260615_135232', 'index.html');
const outDir = path.join(root, 'chat_history', 'site-check');
fs.mkdirSync(outDir, { recursive: true });

function fail(msg) {
  console.error('[site-check] ' + msg);
  process.exit(1);
}

if (!fs.existsSync(sitePath)) fail('Site file not found: ' + sitePath);

let chromium;
try {
  chromium = require('playwright').chromium;
} catch {
  fail('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
}

(async () => {
  const html = fs.readFileSync(sitePath, 'utf8');
  const staticChecks = [
    ['has actual TrelEmu optional mock', html.includes('TrelEmu optional') || html.includes('TrelEmu downloaded')],
    ['has 135 skins mock', html.includes('135') && html.includes('скин')],
    ['has import slide', html.includes("{ id: 'import', label: 'Импорт' }") || html.includes('Import Guard') || html.includes('Official launcher runtime')],
    ['hides old 1.21.4 Fabric mock', !html.includes('1.21.4 + Fabric')],
    ['hides old asset loading mock', !html.includes('Загрузка ассетов')],
    ['hides old Bedrock count 8', !html.includes('Bedrock</span><span class="count">8')],
    ['mentions Defender async', html.includes('Defender async') || html.includes('Async Defender')],
    ['mentions 26.x guard', html.includes('26.x')],
    ['mentions edition=bedrock', html.includes('edition=bedrock')],
  ];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 }, deviceScaleFactor: 1 });
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => pageErrors.push(err.stack || err.message || String(err)));

  await page.goto('file:///' + sitePath.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const info = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const tabs = Array.from(document.querySelectorAll('.shots-tab')).map((x) => (x.textContent || '').trim());
    const slides = Array.from(document.querySelectorAll('.shots-slide')).length;
    const windows = Array.from(document.querySelectorAll('.shot-window')).map((el) => {
      const r = el.getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height), text: (el.textContent || '').slice(0, 600) };
    });
    return {
      title: document.title,
      tabs,
      slides,
      windows,
      hasMojibake: /�|����|Ð|Ñ/.test(text),
      hasImportTab: tabs.includes('Импорт'),
      hasSkinsTab: tabs.includes('Скины'),
      hasOldSkinLabel: tabs.includes('3D-скин') || text.includes('3D-скин'),
      hasOldMock: text.includes('1.21.4 + Fabric') || text.includes('Загрузка ассетов') || text.includes('42%'),
      hasTrelEmuOptional: text.includes('TrelEmu optional') || text.includes('TrelEmu downloaded'),
      hasImportGuard: text.includes('26.x') || text.includes('Official launcher runtime') || text.includes('Скрыто'),
      has135Skins: text.includes('135') && text.toLowerCase().includes('скин'),
    };
  });

  // Screenshot each mock window, not the whole giant web page.
  const slideScreens = [];
  const slides = await page.$$('.shots-slide');
  for (let i = 0; i < slides.length; i++) {
    await slides[i].scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const tabName = info.tabs[i] || `slide-${i + 1}`;
    const safe = tabName.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || `slide-${i + 1}`;
    const win = await slides[i].$('.shot-window');
    if (!win) continue;
    const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}-${safe}.png`);
    await win.screenshot({ path: file });
    slideScreens.push({ tab: tabName, file });
  }

  // A sane overview screenshot, viewport only, not fullPage.
  await page.screenshot({ path: path.join(outDir, 'site-overview.png'), fullPage: false });

  await browser.close();

  const badWindowSizes = info.windows.filter((w) => w.width < 700 || w.width > 1300 || w.height < 430 || w.height > 900);
  const report = {
    checkedAt: new Date().toISOString(),
    sitePath,
    outDir,
    staticChecks: staticChecks.map(([name, ok]) => ({ name, ok })),
    pageInfo: info,
    consoleMessages,
    pageErrors,
    slideScreens,
    screenshots: { overview: path.join(outDir, 'site-overview.png') },
    verdict: {
      hasErrors: pageErrors.length > 0,
      hasMojibake: info.hasMojibake,
      oldMocksStillVisible: info.hasOldMock || info.hasOldSkinLabel,
      importTabMissing: !info.hasImportTab,
      skinsTabMissing: !info.hasSkinsTab,
      missingTrelEmuOptional: !info.hasTrelEmuOptional,
      missingImportGuard: !info.hasImportGuard,
      missing135Skins: !info.has135Skins,
      badWindowSizes: badWindowSizes.length > 0,
      failedStaticChecks: staticChecks.filter(([, ok]) => !ok).map(([name]) => name),
    },
  };

  fs.writeFileSync(path.join(outDir, 'site-check-report.json'), JSON.stringify(report, null, 2), 'utf8');
  const md = [
    '# Site visual check', '',
    `Checked at: ${report.checkedAt}`,
    `Site: ${sitePath}`, '',
    '## Static checks', '',
    ...report.staticChecks.map((x) => `- ${x.ok ? '✅' : '❌'} ${x.name}`), '',
    '## Runtime', '',
    `- Page errors: ${pageErrors.length}`,
    `- Console messages: ${consoleMessages.length}`,
    `- Mojibake: ${info.hasMojibake}`,
    `- Import tab: ${info.hasImportTab}`,
    `- Skins tab: ${info.hasSkinsTab}`,
    `- Old skin label visible: ${info.hasOldSkinLabel}`,
    `- Old mock visible: ${info.hasOldMock}`,
    `- Bad mock window sizes: ${badWindowSizes.length}`, '',
    '## Mock screenshots', '',
    ...slideScreens.map((x) => `- ${x.tab}: ${x.file}`), '',
    '## Mock window sizes', '', '```json', JSON.stringify(info.windows.map((w, i) => ({ tab: info.tabs[i], width: w.width, height: w.height })), null, 2), '```', '',
    '## Console', '', '```text', consoleMessages.join('\n') || 'No console messages', '```', '',
    '## Page errors', '', '```text', pageErrors.join('\n') || 'No page errors', '```', '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'site-check-report.md'), md, 'utf8');

  console.log('[site-check] Done');
  console.log('[site-check] Report:', path.join(outDir, 'site-check-report.md'));
  console.log('[site-check] Overview:', path.join(outDir, 'site-overview.png'));
  console.log('[site-check] Slide screenshots:', slideScreens.map((x) => x.file).join('; '));
  console.log('[site-check] Verdict:', JSON.stringify(report.verdict, null, 2));

  if (Object.values(report.verdict).some((v) => Array.isArray(v) ? v.length > 0 : v === true)) process.exit(3);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
