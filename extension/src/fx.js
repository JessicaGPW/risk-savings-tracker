// Exchange rates to EUR, frozen on the entry date.
// Fiat (BRL): Frankfurter — European Central Bank reference rates, no key needed.
// Crypto: CoinGecko (spot price today; historical price for past dates).
import { CONFIG, CRYPTOS } from './config.js';
import { store } from './store.js';

const today = () => new Date().toISOString().slice(0, 10);

async function getJSON(url, headers = {}) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`Exchange rate unavailable (${r.status})`);
  return r.json();
}

async function fiatRate(currency, date) {
  const path = date >= today() ? 'latest' : date;
  const urls = [
    `https://api.frankfurter.dev/v1/${path}?base=${currency}&symbols=EUR`,
    `https://api.frankfurter.app/${path}?from=${currency}&to=EUR`,
  ];
  let lastErr;
  for (const u of urls) {
    try {
      const j = await getJSON(u);
      if (j?.rates?.EUR) return j.rates.EUR;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('BRL→EUR rate unavailable');
}

async function cryptoRate(symbol, date) {
  const c = CRYPTOS.find((x) => x.symbol === symbol);
  if (!c) throw new Error(`Unsupported crypto: ${symbol}`);
  const headers = CONFIG.COINGECKO_DEMO_KEY ? { 'x-cg-demo-api-key': CONFIG.COINGECKO_DEMO_KEY } : {};
  if (date >= today()) {
    const j = await getJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${c.id}&vs_currencies=eur`, headers);
    if (j?.[c.id]?.eur) return j[c.id].eur;
  } else {
    const [y, m, d] = date.split('-');
    const j = await getJSON(`https://api.coingecko.com/api/v3/coins/${c.id}/history?date=${d}-${m}-${y}&localization=false`, headers);
    const v = j?.market_data?.current_price?.eur;
    if (v) return v;
  }
  throw new Error(`${symbol}→EUR rate unavailable`);
}

/** Returns the rate (1 unit = X EUR) for the date. Local cache per currency+date. */
export async function rateToEUR(currency, date = today()) {
  if (currency === 'EUR') return 1;
  const key = `fx:${currency}:${date}`;
  const cached = await store.get(key);
  // Today's rate is cached for 1h; past dates are cached forever.
  if (cached && (date < today() || Date.now() - cached.t < 3600e3)) return cached.rate;
  const isCrypto = CRYPTOS.some((c) => c.symbol === currency);
  const rate = isCrypto ? await cryptoRate(currency, date) : await fiatRate(currency, date);
  await store.set(key, { rate, t: Date.now() });
  return rate;
}

export const round2 = (n) => Math.round(n * 100) / 100;
