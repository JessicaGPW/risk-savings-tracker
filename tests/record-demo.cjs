// Records the portfolio demo video (fictional data) with a visible cursor and captions.
// Usage: node tests/record-demo.cjs <extension-dir> <output-dir>
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ext = path.resolve(process.argv[2] || 'extension');
const out = path.resolve(process.argv[3] || 'media');
const tmp = path.join(out, '.raw');
fs.mkdirSync(tmp, { recursive: true });
const W = 1280, H = 800, PORT = 8092;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Overlay (cursor + caption) drawn in the top page, above the extension drawer.
const OVERLAY = `(() => {
  if (window.__ov) return; window.__ov = true;
  const add = () => {
    const c = document.createElement('div'); c.id = '__cursor';
    c.style.cssText = 'position:fixed;left:640px;top:400px;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:left .55s cubic-bezier(.3,.7,.3,1),top .55s cubic-bezier(.3,.7,.3,1)';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const r = document.createElement('div'); r.id = '__ring';
    r.style.cssText = 'position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #34D399;z-index:2147483647;pointer-events:none;opacity:0;transform:scale(.4);transition:opacity .35s,transform .35s';
    const cap = document.createElement('div'); cap.id = '__cap';
    cap.style.cssText = 'position:fixed;left:24px;bottom:24px;max-width:780px;z-index:2147483647;pointer-events:none;background:rgba(14,17,22,.92);color:#fff;font:600 17px/1.4 system-ui,sans-serif;padding:12px 18px;border-radius:12px;border-left:4px solid #34D399;box-shadow:0 8px 30px rgba(0,0,0,.35);opacity:0;transition:opacity .35s';
    document.documentElement.append(c, r, cap);
  };
  if (document.body) add(); else addEventListener('DOMContentLoaded', add);
  window.__move = (x, y) => { const c = document.getElementById('__cursor'); c.style.left = x + 'px'; c.style.top = y + 'px'; };
  window.__click = (x, y) => { const r = document.getElementById('__ring'); r.style.transition = 'none'; r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.opacity = 1; r.style.transform = 'scale(.4)'; r.offsetWidth; r.style.transition = 'opacity .45s, transform .45s'; r.style.opacity = 0; r.style.transform = 'scale(1.4)'; };
  window.__caption = (t) => { const c = document.getElementById('__cap'); if (!t) { c.style.opacity = 0; return; } c.textContent = t; c.style.opacity = 1; };
  window.__title = (t, s) => {
    let o = document.getElementById('__titlecard');
    if (!t) { if (o) { o.style.opacity = 0; setTimeout(() => o.remove(), 500); } return; }
    o = document.createElement('div'); o.id = '__titlecard';
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(circle at 50% 40%,#132a22,#0E1116 70%);color:#fff;font-family:system-ui,sans-serif;transition:opacity .5s;text-align:center';
    o.innerHTML = '<div style="font-size:64px;color:#34D399;font-weight:800">€</div><div style="font-size:40px;font-weight:800;letter-spacing:-.02em"></div><div style="font-size:19px;color:#9CA3AF;max-width:760px;line-height:1.5"></div>';
    o.children[1].textContent = t; o.children[2].textContent = s || '';
    document.documentElement.append(o);
  };
})();`;

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'tools', 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await wait(700);
  const ctx = await chromium.launchPersistentContext('', { headless: true, args: [
    `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--headless=new', '--lang=en-GB'],
    viewport: { width: W, height: H }, locale: 'en-GB', recordVideo: { dir: tmp, size: { width: W, height: H } } });
  await ctx.addInitScript(OVERLAY);
  const page = ctx.pages()[0] || await ctx.newPage();
  let cur = { x: 640, y: 400 };

  const move = async (x, y) => { await page.evaluate(([a, b]) => window.__move(a, b), [x, y]); await page.mouse.move(x, y, { steps: 8 }); cur = { x, y }; await wait(600); };
  const caption = (t) => page.evaluate((s) => window.__caption(s), t);
  const panel = () => page.frames().find((f) => f.url().includes('panel.html'));
  const boxOf = async (frameOrPage, sel) => {
    const b = await frameOrPage.locator(sel).first().boundingBox();
    if (!b) throw new Error('No box for ' + sel);
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  };
  const click = async (frameOrPage, sel, opts = {}) => {
    const p = await boxOf(frameOrPage, sel);
    await move(p.x, p.y);
    await page.evaluate(([a, b]) => window.__click(a, b), [p.x, p.y]);
    await frameOrPage.locator(sel).first().click(opts);
    await wait(opts.after ?? 700);
  };
  const type = async (frame, sel, text) => {
    await click(frame, sel, { after: 200 });
    await frame.locator(sel).first().fill('');
    await frame.locator(sel).first().pressSequentially(text, { delay: 110 });
    await wait(900);
  };
  const choose = async (frame, sel, value) => { await click(frame, sel, { after: 250 }); await frame.selectOption(sel, value); await wait(900); };

  try {
    // 0 — title card
    await page.goto(`http://kestrel.localhost:${PORT}/demo-site/`);
    await page.evaluate(() => window.__title('Risk Savings Tracker', 'Chrome extension that shows how much money a risk team saves by closing fraudulent accounts, in EUR, per brand. Fictional brands and data.'));
    await wait(3800);
    await page.evaluate(() => window.__title(null));
    await wait(700);

    // 1 — back office
    await caption('A simulated back office of a fictional brand. The extension adds a € SAVINGS tab on the right.');
    await move(500, 300); await wait(1800);

    // 2 — open drawer
    const hx = Math.round(W - 17), hy = Math.round(H / 2);
    await move(hx, hy); await page.evaluate(([a, b]) => window.__click(a, b), [hx, hy]);
    await page.keyboard.press('Alt+r');
    await wait(2200);
    let f = panel();
    await caption('Dashboard: total saved this month in EUR, a card per brand (the current one is highlighted) and local currencies.');
    await move(1080, 330); await wait(3200);

    await caption('Closure reasons ranked by number of accounts… or by value.');
    await f.locator('#reasons').scrollIntoViewIfNeeded(); await wait(700);
    await click(f, '[data-basis="eur"]', { after: 1800 });
    await click(f, '[data-basis="count"]', { after: 1200 });

    await caption('Switch between week, month and year, and browse previous periods.');
    await f.locator('.tabs').scrollIntoViewIfNeeded();
    await click(f, '[data-kind="year"]', { after: 1500 });
    await click(f, '#prev', { after: 1400 });
    await click(f, '#next', { after: 900 });
    await click(f, '[data-kind="month"]', { after: 900 });

    // 3 — log an entry
    await caption('Logging a closure: the brand comes pre-selected from the back office you are on.');
    await click(f, '[data-tab="add"]', { after: 1300 });
    await type(f, '#fAmount', '1250.00');
    await choose(f, '#fReason', 'bonus_abuser');
    await click(f, '#fSecondary input[value="multi_acc"]', { after: 900 });
    await caption('The amount is converted to EUR with the rate of the day and frozen with the entry.');
    await wait(1800);
    await click(f, '#btnSave', { after: 2200 });

    // 4 — crypto brand
    await caption('Crypto brands accept 10 coins — rates come from CoinGecko in production.');
    await choose(f, '#fBrand', 'nimbus');
    await choose(f, '#fCur', 'BTC');
    await type(f, '#fAmount', '0.015');
    await wait(1400);

    // 5 — history
    await caption('History with brand filter. Admins can edit or soft-delete; nothing is ever hard-deleted.');
    await click(f, '[data-tab="hist"]', { after: 1600 });
    await click(f, '#hist li .acts button', { after: 1800 });
    await click(f, '#hist li .edit .acts button', { after: 900 });
    await choose(f, '#hBrand', 'kestrel');
    await wait(900);
    await choose(f, '#hBrand', '');

    // 6 — CSV
    await caption('One click exports the period report as CSV (summary + entries, no player data).');
    await click(f, '[data-tab="dash"]', { after: 900 });
    await f.locator('#btnCSV').scrollIntoViewIfNeeded(); await wait(500);
    await click(f, '#btnCSV', { after: 1800 });

    // 7 — another brand
    await caption('On another brand’s back office, that brand is highlighted automatically.');
    await page.goto(`http://lynx.localhost:${PORT}/demo-site/`);
    await wait(1400);
    await page.keyboard.press('Alt+r'); await wait(2200);
    f = panel();
    await move(1080, 330); await wait(2800);

    // end card
    await caption(null);
    await page.evaluate(() => window.__title('Risk Savings Tracker', 'Chrome MV3 · zero-dependency JavaScript · Firebase (Auth + Firestore REST) · Firestore security rules · Google Sheets mirror via Apps Script · Playwright E2E'));
    await wait(4200);
  } finally {
    const video = page.video();
    await ctx.close(); server.kill();
    const src = await video.path();
    fs.renameSync(src, path.join(out, 'demo.webm'));
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('Video saved to', path.join(out, 'demo.webm'));
  }
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
