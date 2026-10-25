// DEMO adapter: local fictional data, no network. Used by the tests and the portfolio build.
// Every brand, operator and amount generated here is invented.
import { BRANDS, REASONS, CRYPTOS } from './config.js';
import { store } from './store.js';
import { localISO } from './stats.js';

const KEY = 'demo:entries';
const DEMO_USER = { email: 'you@demo.example', name: 'Demo Analyst' };
const OPERATORS = ['alex.rivera@demo.example', 'sam.okafor@demo.example', 'mia.tanaka@demo.example', 'leo.martins@demo.example'];
// Fixed, illustrative rates (1 unit = X EUR). Not market data.
const FAKE_FX = { EUR: 1, BRL: 0.17, USDT: 0.92, USDC: 0.92, BTC: 61000, ETH: 2400, LTC: 70, TRX: 0.25, BNB: 520, SOL: 140, XRP: 0.5, DOGE: 0.12 };

function seed() {
  // Deterministic pseudo-random generator: the demo always looks the same.
  let s = 42; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = (a, w) => { let r = rnd() * w.reduce((x, y) => x + y, 0); for (let i = 0; i < a.length; i++) { r -= w[i]; if (r <= 0) return a[i]; } return a[0]; };
  const now = new Date();
  const out = [];
  const active = BRANDS.filter((b) => b.active);
  for (let i = 0; i < 520; i++) {
    const daysAgo = Math.floor(rnd() * 420);
    const d = localISO(new Date(now.getTime() - daysAgo * 864e5));
    const b = pick(active, active.map((_, k) => [5, 9, 3, 4, 2][k] || 2));
    let cur = b.currencies[Math.floor(rnd() * b.currencies.length)];
    if (cur === 'CRYPTO') cur = pick(CRYPTOS.map((c) => c.symbol), [6, 3, 2, 1, 1, 1, 1, 1, 1, 1]);
    const eurTarget = Math.round((40 + rnd() ** 3 * 3500) * 100) / 100;
    const rate = FAKE_FX[cur];
    const prec = cur === 'BTC' || cur === 'ETH' ? 1e6 : 100;
    const amount = Math.round((eurTarget / rate) * prec) / prec;
    const reason = pick(REASONS.map((r) => r.id), [55, 18, 15, 12]);
    const secondary = rnd() < 0.2 ? [REASONS.find((r) => r.id !== reason && rnd() < 0.7)?.id || 'fraud'].filter((x) => x !== reason) : [];
    const by = OPERATORS[Math.floor(rnd() * OPERATORS.length)];
    // Never in the future: incremental sync relies on updatedAt being <= now.
    const t = new Date(Math.min(Date.parse(d + 'T12:00:00Z'), now.getTime() - 60e3)).toISOString();
    out.push({ id: 'demo' + i, brand: b.id, reason, secondary, amount, currency: cur, rate, eur: Math.round(amount * rate * 100) / 100,
      date: d, month: d.slice(0, 7), deleted: false, source: 'demo', createdBy: by, updatedBy: by, createdAt: t, updatedAt: t });
  }
  return out;
}

async function all() {
  let e = await store.get(KEY);
  if (!e) { e = seed(); await store.set(KEY, e); }
  return e;
}

export const demoAdapter = {
  name: 'demo',
  user: DEMO_USER,
  fakeRate: (cur) => FAKE_FX[cur] ?? 1,
  async isAdmin() { return true; },
  async create(entry) {
    const e = await all(); const t = new Date().toISOString();
    const id = 'd' + Date.now();
    e.push({ ...entry, id, deleted: false, createdBy: DEMO_USER.email, updatedBy: DEMO_USER.email, createdAt: t, updatedAt: t });
    await store.set(KEY, e); return id;
  },
  async update(id, patch) {
    const e = await all(); const i = e.findIndex((x) => x.id === id);
    if (i < 0) throw new Error('Entry not found');
    e[i] = { ...e[i], ...patch, updatedAt: new Date().toISOString(), updatedBy: DEMO_USER.email };
    await store.set(KEY, e);
  },
  async remove(id) { return this.update(id, { deleted: true }); },
  async changedSince(sinceIso) {
    const e = await all();
    return sinceIso ? e.filter((x) => x.updatedAt > sinceIso) : e;
  },
  async reset() { await store.remove(KEY); await store.remove('cache:demo:entries'); await store.remove('cache:demo:since'); },
};
