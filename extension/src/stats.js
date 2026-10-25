// Period maths, totals and reason ranking.
import { BRANDS, REASONS, LOCALE } from './config.js';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local calendar date as YYYY-MM-DD (toISOString() would use UTC and jump a day in the evening). */
export const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 2026-10-24 -> 24/10/2026 */
export const fmtDate = (isoDate) => isoDate.split('-').reverse().join('/');

/** Period from a kind (week|month|year) and an anchor date. */
export function periodOf(kind, anchor = new Date()) {
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  let start, end, label;
  if (kind === 'week') {
    const dow = (a.getDay() + 6) % 7; // Monday = 0
    start = new Date(a); start.setDate(a.getDate() - dow);
    end = new Date(start); end.setDate(start.getDate() + 6);
    label = `${pad(start.getDate())}/${pad(start.getMonth() + 1)} – ${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`;
  } else if (kind === 'year') {
    start = new Date(a.getFullYear(), 0, 1); end = new Date(a.getFullYear(), 11, 31);
    label = String(a.getFullYear());
  } else {
    start = new Date(a.getFullYear(), a.getMonth(), 1); end = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    label = `${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
  }
  return { kind, start: iso(start), end: iso(end), label, anchor: a };
}

export function shiftPeriod(p, dir) {
  const a = new Date(p.anchor);
  if (p.kind === 'week') a.setDate(a.getDate() + 7 * dir);
  else if (p.kind === 'year') a.setFullYear(a.getFullYear() + dir);
  else a.setMonth(a.getMonth() + dir, 1);
  return periodOf(p.kind, a);
}

export const inPeriod = (entries, p) => entries.filter((e) => e.date >= p.start && e.date <= p.end);

export function summarize(entries) {
  const totalEUR = entries.reduce((s, e) => s + (e.eur || 0), 0);
  const brands = BRANDS.map((b) => {
    const list = entries.filter((e) => e.brand === b.id);
    const local = {};
    for (const e of list) local[e.currency] = (local[e.currency] || 0) + e.amount;
    return { brand: b, count: list.length, eur: list.reduce((s, e) => s + e.eur, 0), local };
  }).filter((x) => x.brand.active || x.count > 0);

  const reasons = REASONS.map((r) => {
    const list = entries.filter((e) => e.reason === r.id);
    const secondary = entries.filter((e) => (e.secondary || []).includes(r.id)).length;
    return { reason: r, count: list.length, eur: list.reduce((s, e) => s + e.eur, 0), secondary };
  });
  const n = entries.length || 1;
  for (const r of reasons) { r.pctCount = (r.count / n) * 100; r.pctEUR = totalEUR ? (r.eur / totalEUR) * 100 : 0; }
  return { totalEUR, count: entries.length, brands, reasons };
}

const nf = (cur, max = 2) => new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: max });
export function money(v, cur = 'EUR') {
  if (cur === 'EUR' || cur === 'BRL') return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur }).format(v);
  const crypto = ['BTC', 'ETH'].includes(cur) ? 6 : 2;
  return `${nf(cur, crypto).format(v)} ${cur}`;
}

/** CSV (comma-separated) with period summary + entries. No player data. */
export function toCSV(entries, p) {
  const s = summarize(entries);
  const L = [];
  const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const n = (x, d = 2) => Number(x).toFixed(d);
  const t = (x) => x.replace(/\.?0+$/, '');
  L.push(q(`Savings report — ${p.label} (${p.start} to ${p.end})`));
  L.push(`Total saved (EUR),${n(s.totalEUR)}`);
  L.push(`Accounts closed,${s.count}`);
  L.push('');
  L.push('Brand,Accounts,Total EUR,Local currency');
  for (const b of s.brands) L.push([q(b.brand.name), b.count, n(b.eur), q(Object.entries(b.local).map(([c, v]) => `${t(n(v, 6))} ${c}`).join(' + '))].join(','));
  L.push('');
  L.push('Reason,Accounts,% accounts,EUR,% value');
  for (const r of [...s.reasons].sort((a, b) => b.count - a.count)) L.push([q(r.reason.label), r.count, n(r.pctCount, 1), n(r.eur), n(r.pctEUR, 1)].join(','));
  L.push('');
  L.push('Date,Brand,Main reason,Secondary reasons,Amount,Currency,EUR rate,EUR value,Logged by');
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    L.push([e.date, q(BRANDS.find((b) => b.id === e.brand)?.name || e.brand), q(REASONS.find((r) => r.id === e.reason)?.label || e.reason),
      q((e.secondary || []).map((x) => REASONS.find((r) => r.id === x)?.label || x).join(', ')), t(n(e.amount, 8)), e.currency, t(n(e.rate, 8)), n(e.eur), q(e.createdBy)].join(','));
  }
  return '﻿' + L.join('\r\n');
}
