// End-to-end test of the extension in demo mode on the simulated back offices.
// Usage: node tests/e2e.cjs <extension-dir> <output-dir>
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ext = path.resolve(process.argv[2] || 'extension');
const out = path.resolve(process.argv[3] || 'test-output');
fs.mkdirSync(out, { recursive: true });
const assert = (ok, msg) => { if (!ok) throw new Error('Assertion failed: ' + msg); console.log('  ✓ ' + msg); };

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'tools', 'serve.mjs')], { env: { ...process.env, PORT: '8091' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  const ctx = await chromium.launchPersistentContext('', { headless: true, args: [
    `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new', '--lang=en-GB'], viewport: { width: 1280, height: 860 }, locale: 'en-GB' });
  const errors = [];
  try {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://kestrel.localhost:8091/demo-site/');
    await page.waitForTimeout(1200);
    await page.keyboard.press('Alt+r');
    await page.waitForTimeout(2000);
    const frame = page.frames().find((f) => f.url().includes('panel.html'));
    assert(frame, 'panel iframe injected by the content script');

    const total = await frame.textContent('#totalEUR');
    assert(/€/.test(total), `dashboard total rendered (${total})`);
    assert((await frame.$$eval('.brand', (n) => n.length)) >= 5, 'brand cards rendered');
    assert((await frame.$$eval('.brand.current', (n) => n.length)) === 1, 'current brand detected from host');
    await page.screenshot({ path: path.join(out, '01_dashboard.png') });

    await frame.click('[data-basis="eur"]');
    await frame.click('[data-kind="year"]'); await page.waitForTimeout(300);
    assert(/^\d{4}$/.test(await frame.textContent('#plabel')), 'year period selected');

    await frame.click('[data-tab="add"]');
    assert((await frame.inputValue('#fBrand')) === 'kestrel', 'brand preselected from back office');
    await frame.fill('#fAmount', '1,234.56'); await page.waitForTimeout(700);
    assert(/1,234\.56/.test(await frame.textContent('#preview')), 'EUR preview computed');
    await frame.check('#fSecondary input[value="fraud"]');
    await page.screenshot({ path: path.join(out, '03_log.png') });
    await frame.click('#btnSave'); await page.waitForTimeout(700);
    assert(/Logged/.test(await frame.textContent('#formMsg')), 'entry saved');

    await frame.click('[data-tab="hist"]'); await page.waitForTimeout(300);
    assert((await frame.$$eval('#hist li', (n) => n.length)) > 1, 'history listed');
    assert((await frame.textContent('#hist')).includes('€1,234.56'), 'new entry appears in history');
    assert(!(await frame.textContent('#hist')).includes('rate'), 'exchange rate hidden from history lines');
    await page.screenshot({ path: path.join(out, '02_history.png') });

    await frame.click('[data-tab="add"]'); await frame.selectOption('#fBrand', 'nimbus');
    const curs = await frame.$$eval('#fCur option', (o) => o.map((x) => x.value));
    assert(curs.includes('BTC') && curs.includes('USDT'), 'crypto currencies for the crypto brand');

    await frame.click('#btnClose'); await page.waitForTimeout(500);
    assert(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    console.log('PASS');
  } finally {
    await ctx.close(); server.kill();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
