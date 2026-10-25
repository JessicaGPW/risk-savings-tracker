// Drawer UI (runs inside an extension iframe, or as a standalone page in the demo).
import { CONFIG, BRANDS, REASONS, CRYPTOS, LOCALE, brandById, reasonById } from './config.js';
import { adapter, sync, cached } from './data.js';
import { periodOf, shiftPeriod, inPeriod, summarize, money, toCSV, fmtDate, localISO } from './stats.js';
import { rateToEUR, round2 } from './fx.js';
import * as auth from './auth.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const isDemo = CONFIG.MODE === 'demo';
const inExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

// Safe element builder (never uses innerHTML with data)
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

const params = new URLSearchParams(location.search);
const host = (params.get('host') || '').toLowerCase();
const currentBrand = BRANDS.find((b) => b.hosts.some((x) => host === x || host.endsWith('.' + x)));

const state = { entries: [], period: periodOf('month'), basis: 'count', tab: 'dash', admin: false, user: null, lastSync: null };

function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = `toast ${kind}`; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 3500);
}

const brandVars = (b) => `--b-primary:${b.colors.primary};--b-bg:${b.colors.bg};--b-surface:${b.colors.surface}`;
const fmtLocal = (local) => Object.entries(local).map(([c, v]) => money(v, c)).join(' + ') || '—';

// ---------------- Render: Dashboard ----------------
function renderDash() {
  const list = inPeriod(state.entries, state.period);
  const s = summarize(list);
  $('#totalEUR').textContent = money(s.totalEUR);
  $('#totalCount').textContent = `${s.count} ${s.count === 1 ? 'account closed' : 'accounts closed'}`;

  const brands = [...s.brands].sort((a, b) => (b.brand.id === currentBrand?.id) - (a.brand.id === currentBrand?.id) || b.eur - a.eur);
  $('#brands').replaceChildren(...brands.map(({ brand, count, eur, local }) =>
    h('article', { class: `brand ${brand.id === currentBrand?.id ? 'current' : ''}`, style: brandVars(brand) },
      h('div', { class: 'brand-h' },
        h('div', { class: 'bname' }, h('img', { src: brand.logo, alt: '' }), h('span', {}, brand.name)),
        h('span', { class: `tag ${brand.active ? '' : 'off'}` }, brand.active ? brand.short : 'soon')),
      h('div', { class: 'brand-b' },
        h('span', { class: 'eur' }, money(eur)),
        h('span', { class: 'cnt' }, `${count} ${count === 1 ? 'account' : 'accounts'}`),
        h('span', { class: 'loc' }, `Local currency: ${fmtLocal(local)}`),
        h('div', { class: 'bar' }, h('i', { style: `width:${s.totalEUR ? (eur / s.totalEUR) * 100 : 0}%` }))))));

  const key = state.basis === 'count' ? 'pctCount' : 'pctEUR';
  const ranked = [...s.reasons].sort((a, b) => b[key] - a[key]);
  $('#reasons').replaceChildren(...ranked.map((r, i) =>
    h('li', { style: `--b-primary:${r.reason.color}` },
      h('span', { class: 'pos' }, `${i + 1}`),
      h('span', {}, r.reason.label),
      h('span', { class: 'pct' }, `${r[key].toFixed(1)}%`),
      h('div', { class: 'bar' }, h('i', { style: `width:${r[key]}%` })),
      h('span', { class: 'sub' }, `${r.count} accounts · ${money(r.eur)}${r.secondary ? ` · +${r.secondary} as secondary` : ''}`))));

  $('#lastSync').textContent = state.lastSync ? `Updated at ${state.lastSync.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}${isDemo ? ' · demo mode (fictional data)' : ''}` : '';
}

// ---------------- Render: History ----------------
function renderHist() {
  const fb = $('#hBrand').value;
  const list = inPeriod(state.entries, state.period).filter((e) => !fb || e.brand === fb)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (!list.length) return $('#hist').replaceChildren(h('li', { class: 'empty', style: 'display:block;border:0;background:none' }, 'No entries in this period.'));
  $('#hist').replaceChildren(...list.slice(0, 300).map((e) => {
    const b = brandById(e.brand) || { name: e.brand, colors: { primary: '#666', bg: '#000', surface: '#111' } };
    const li = h('li', { style: brandVars(b) },
      h('span', { class: 'l1' }, `${b.name} · ${reasonById(e.reason)?.label || e.reason}`),
      h('span', { class: 'eur' }, money(e.eur)),
      h('span', { class: 'l2', title: e.currency === 'EUR' ? '' : `Rate used: 1 ${e.currency} = ${Number(e.rate).toLocaleString(LOCALE, { maximumFractionDigits: 6 })} EUR` }, `${fmtDate(e.date)} · ${money(e.amount, e.currency)}` +
        `${e.secondary?.length ? ' · +' + e.secondary.map((x) => reasonById(x)?.label || x).join(', ') : ''} · by ${e.createdBy || '—'}`));
    if (state.admin) {
      li.append(h('div', { class: 'acts' },
        h('button', { onclick: () => editRow(li, e) }, 'Edit'),
        h('button', { class: 'danger', onclick: () => confirmDelete(li, e) }, 'Delete')));
    }
    return li;
  }));
}

function confirmDelete(li, e) {
  const box = h('div', { class: 'acts' },
    h('span', { class: 'danger', style: 'margin-right:auto' }, 'Delete this entry?'),
    h('button', { onclick: () => box.replaceWith(acts) }, 'Cancel'),
    h('button', { class: 'danger', onclick: async () => {
      try { await adapter.remove(e.id); toast('Entry deleted', 'ok'); await refresh(); }
      catch (err) { toast(err.message, 'err'); }
    } }, 'Confirm'));
  const acts = li.querySelector('.acts');
  acts.replaceWith(box);
}

function editRow(li, e) {
  if (li.querySelector('.edit')) return;
  const amount = h('input', { value: String(e.amount), inputmode: 'decimal', 'aria-label': 'Amount' });
  const reason = h('select', { 'aria-label': 'Reason' }, REASONS.map((r) => h('option', { value: r.id, selected: r.id === e.reason }, r.label)));
  const box = h('div', { class: 'edit' },
    h('div', { class: 'row' }, amount, reason),
    h('div', { class: 'acts' },
      h('button', { onclick: () => box.remove() }, 'Cancel'),
      h('button', { onclick: async () => {
        const v = parseAmount(amount.value);
        if (!(v > 0)) return toast('Invalid amount', 'err');
        try {
          await adapter.update(e.id, { amount: v, reason: reason.value, eur: round2(v * e.rate),
            secondary: (e.secondary || []).filter((x) => x !== reason.value) });
          toast('Entry updated', 'ok'); await refresh();
        } catch (err) { toast(err.message, 'err'); }
      } }, 'Save')));
  li.append(box);
}

// ---------------- Log form ----------------
function parseAmount(s) {
  s = String(s).trim().replace(/\s/g, '');
  // Accepts 1,234.56 / 1234.56 / 1.234,56 / 1234,56
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function fillCurrencies() {
  const b = brandById($('#fBrand').value);
  const curs = b.currencies.flatMap((c) => (c === 'CRYPTO' ? CRYPTOS.map((x) => x.symbol) : [c]));
  $('#fCur').replaceChildren(...curs.map((c) => h('option', { value: c }, c)));
}
function fillSecondary() {
  const main = $('#fReason').value;
  const checked = new Set($$('#fSecondary input:checked').map((i) => i.value));
  $('#fSecondary').replaceChildren(...REASONS.filter((r) => r.id !== main).map((r) =>
    h('label', {}, h('input', { type: 'checkbox', value: r.id, checked: checked.has(r.id) }), r.label)));
}

let previewSeq = 0;
async function updatePreview() {
  const seq = ++previewSeq;
  const amt = parseAmount($('#fAmount').value);
  const cur = $('#fCur').value, date = $('#fDate').value;
  const p = $('#preview');
  if (!(amt > 0) || !date) { p.textContent = 'Enter an amount to see the euro conversion.'; return null; }
  p.textContent = 'Fetching exchange rate…';
  try {
    const rate = isDemo ? adapter.fakeRate(cur) : await rateToEUR(cur, date);
    if (seq !== previewSeq) return null;
    const eur = round2(amt * rate);
    p.replaceChildren('≈ ', h('b', {}, money(eur)), h('br'), `Rate on ${fmtDate(date)}: 1 ${cur} = ${rate.toLocaleString(LOCALE, { maximumFractionDigits: 6 })} EUR${isDemo ? ' (demo rate)' : ''}`);
    return { rate, eur };
  } catch (e) {
    if (seq === previewSeq) p.textContent = `⚠ ${e.message}. Please try again shortly.`;
    return null;
  }
}

async function submitForm(ev) {
  ev.preventDefault();
  const msg = $('#formMsg'); msg.className = 'msg'; msg.textContent = '';
  const amount = parseAmount($('#fAmount').value);
  const date = $('#fDate').value;
  if (!(amount > 0) || amount > 1e8) { msg.className = 'msg err'; msg.textContent = 'Enter a valid amount.'; return; }
  if (!date || date > localISO()) { msg.className = 'msg err'; msg.textContent = 'Invalid date.'; return; }
  const btn = $('#btnSave'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const fx = await updatePreview();
    if (!fx) throw new Error('No exchange rate right now — please try again.');
    await adapter.create({
      brand: $('#fBrand').value, reason: $('#fReason').value,
      secondary: $$('#fSecondary input:checked').map((i) => i.value),
      amount, currency: $('#fCur').value, rate: fx.rate, eur: fx.eur,
      date, month: date.slice(0, 7), source: 'extension',
    });
    msg.className = 'msg ok'; msg.textContent = `Logged: ${money(fx.eur)} saved.`;
    $('#fAmount').value = ''; $$('#fSecondary input').forEach((i) => (i.checked = false));
    $('#preview').textContent = 'Enter an amount to see the euro conversion.';
    await refresh();
  } catch (e) {
    msg.className = 'msg err'; msg.textContent = e.message;
  } finally { btn.disabled = false; btn.textContent = 'Log savings'; }
}

// ---------------- Admin: import ----------------
async function importFile(file) {
  const out = $('#importMsg');
  try {
    const rows = JSON.parse(await file.text());
    if (!Array.isArray(rows)) throw new Error('File must contain a list');
    const valid = rows.filter((r) => brandById(r.brand) && reasonById(r.reason) && r.amount > 0 && r.rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
    out.textContent = `Importing ${valid.length} of ${rows.length}…`;
    let n = 0;
    for (const r of valid) {
      await adapter.create({ brand: r.brand, reason: r.reason, secondary: (r.secondary || []).filter((x) => reasonById(x)),
        amount: r.amount, currency: r.currency, rate: r.rate, eur: round2(r.eur ?? r.amount * r.rate),
        date: r.date, month: r.date.slice(0, 7), source: r.source || 'import' });
      out.textContent = `Importing… ${++n}/${valid.length}`;
    }
    out.className = 'msg ok'; out.textContent = `${n} entries imported.`;
    await refresh();
  } catch (e) { out.className = 'msg err'; out.textContent = e.message; }
}

// ---------------- App flow ----------------
function renderPeriod() {
  $('#plabel').textContent = state.period.label;
  $$('.period .seg button').forEach((b) => b.classList.toggle('active', b.dataset.kind === state.period.kind));
  renderDash(); renderHist();
}

async function refresh(showSpin = true) {
  const btn = $('#btnSync');
  if (showSpin) btn.classList.add('spin');
  try {
    state.entries = await sync();
    state.lastSync = new Date();
  } catch (e) {
    state.entries = await cached();
    if (e.status === 401 || /authenticated|expired/i.test(e.message)) return showLogin(e.message);
    toast(`Cannot reach the database: ${e.message}. Showing saved data.`, 'err');
  } finally { btn.classList.remove('spin'); }
  renderPeriod();
}

function showLogin(err = '') {
  $('#main').hidden = true; $('#login').hidden = false; $('#btnLogout').hidden = true;
  $('#who').textContent = 'signed out';
  $('#loginErr').textContent = err;
}

async function startApp() {
  $('#login').hidden = true; $('#main').hidden = false;
  $('#btnLogout').hidden = isDemo;
  state.user = isDemo ? adapter.user : await auth.currentUser();
  state.admin = await adapter.isAdmin().catch(() => false);
  $('#who').textContent = `${state.user?.email || ''}${state.admin ? ' · admin' : ''}`;
  $('#adminTools').hidden = !state.admin;
  state.entries = await cached();
  renderPeriod();
  await refresh();
}

function setupUI() {
  const active = BRANDS.filter((b) => b.active);
  $('#fBrand').replaceChildren(...active.map((b) => h('option', { value: b.id, selected: b.id === currentBrand?.id }, b.name)));
  $('#hBrand').replaceChildren(h('option', { value: '' }, 'All brands'), ...BRANDS.map((b) => h('option', { value: b.id }, b.name)));
  $('#fReason').replaceChildren(...REASONS.map((r) => h('option', { value: r.id }, r.label)));
  const today = localISO();
  $('#fDate').value = today; $('#fDate').max = today;
  fillCurrencies(); fillSecondary();

  $$('.tabs button').forEach((b) => b.addEventListener('click', () => {
    state.tab = b.dataset.tab;
    $$('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
    $$('.tab').forEach((t) => (t.hidden = t.id !== `tab-${state.tab}`));
    $('.period').hidden = state.tab === 'add';
  }));
  $$('.period .seg button').forEach((b) => b.addEventListener('click', () => { state.period = periodOf(b.dataset.kind, state.period.anchor); renderPeriod(); }));
  $('#prev').onclick = () => { state.period = shiftPeriod(state.period, -1); renderPeriod(); };
  $('#next').onclick = () => { state.period = shiftPeriod(state.period, 1); renderPeriod(); };
  $('#pick').onchange = (e) => { if (e.target.value) { state.period = periodOf(state.period.kind, new Date(e.target.value + 'T12:00:00')); renderPeriod(); } };
  $$('[data-basis]').forEach((b) => b.addEventListener('click', () => {
    state.basis = b.dataset.basis; $$('[data-basis]').forEach((x) => x.classList.toggle('active', x === b)); renderDash();
  }));
  $('#hBrand').onchange = renderHist;
  $('#fBrand').onchange = () => { fillCurrencies(); updatePreview(); };
  $('#fReason').onchange = fillSecondary;
  ['#fCur', '#fDate'].forEach((s) => ($(s).onchange = updatePreview));
  let deb; $('#fAmount').oninput = () => { clearTimeout(deb); deb = setTimeout(updatePreview, 400); };
  $('#form').onsubmit = submitForm;
  $('#btnSync').onclick = () => refresh();
  $('#btnCSV').onclick = () => {
    const blob = new Blob([toCSV(inPeriod(state.entries, state.period), state.period)], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `risk-savings_${state.period.kind}_${state.period.start}.csv` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#fileImport').onchange = (e) => e.target.files[0] && importFile(e.target.files[0]);
  $('#btnClose').onclick = () => window.parent.postMessage({ type: 'risk-panel:close' }, '*');
  $('#btnClose').hidden = window.parent === window;
  $('#btnLogin').onclick = async () => {
    const btn = $('#btnLogin');
    if (btn.disabled) return;
    btn.disabled = true;
    $('#loginErr').textContent = 'Opening Google sign-in…';
    try { await auth.signIn(); $('#loginErr').textContent = ''; await startApp(); }
    catch (e) { $('#loginErr').textContent = e.message; }
    finally { btn.disabled = false; }
  };
  $('#btnLogout').onclick = async () => { await auth.signOut(); showLogin(); };
}

(async function init() {
  setupUI();
  if (isDemo) return startApp();
  if (!inExtension) return showLogin('Open it from the Chrome extension.');
  const u = await auth.currentUser();
  if (u) startApp(); else showLogin();
})();
