/**
 * Automatic Firestore -> Google Sheets mirror (Risk Savings Tracker)
 * Runs as the Firebase project owner (IAM access, no stored key).
 * Creates/updates 2 tabs: "Data (auto)" with every entry and "Summary (auto)" by month/brand/reason.
 * Trigger: run installTrigger() once -> syncs every hour.
 */
const PROJECT_ID = 'YOUR_FIREBASE_PROJECT_ID';
const BRANDS = { kestrel: 'Kestrel Bet', lynx: 'Lynx Casino', orca: 'Orca Slots', vega: 'Vega Play', nimbus: 'Nimbus Crypto', mosaic: 'Mosaic Games' };
const REASONS = { multi_acc: 'Multi-accounting', ip_share: 'Shared IP', bonus_abuser: 'Bonus abuse', fraud: 'Fraudulent activity' };

function syncNow() {
  const docs = readAll_();
  const live = docs.filter(function (d) { return !d.deleted; })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  const ss = SpreadsheetApp.getActive();

  // ---- Data ----
  const base = ss.getSheetByName('Data (auto)') || ss.insertSheet('Data (auto)');
  const header = ['Date', 'Month', 'Brand', 'Main reason', 'Secondary reasons', 'Amount', 'Currency', 'EUR rate', 'EUR value', 'Logged by', 'Source'];
  const rows = live.map(function (d) {
    return [d.date, d.month, BRANDS[d.brand] || d.brand, REASONS[d.reason] || d.reason,
      (d.secondary || []).map(function (x) { return REASONS[x] || x; }).join(', '),
      d.amount, d.currency, d.rate, d.eur, d.createdBy || '', d.source || ''];
  });
  base.clearContents();
  base.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (rows.length) base.getRange(2, 1, rows.length, header.length).setValues(rows);
  base.setFrozenRows(1);

  // ---- Monthly summary ----
  const res = ss.getSheetByName('Summary (auto)') || ss.insertSheet('Summary (auto)');
  const months = {};
  live.forEach(function (d) {
    const m = months[d.month] = months[d.month] || { total: 0, n: 0, brand: {}, reason: {} };
    m.total += d.eur; m.n++;
    m.brand[d.brand] = (m.brand[d.brand] || 0) + d.eur;
    m.reason[d.reason] = (m.reason[d.reason] || 0) + 1;
  });
  const bKeys = Object.keys(BRANDS), rKeys = Object.keys(REASONS);
  const h2 = ['Month', 'Total EUR', 'Accounts'].concat(bKeys.map(function (k) { return BRANDS[k] + ' (EUR)'; }))
    .concat(rKeys.map(function (k) { return REASONS[k] + ' (%)'; }));
  const r2 = Object.keys(months).sort().reverse().map(function (k) {
    const m = months[k];
    return [k, round2_(m.total), m.n].concat(bKeys.map(function (b) { return round2_(m.brand[b] || 0); }))
      .concat(rKeys.map(function (r) { return Math.round(((m.reason[r] || 0) / m.n) * 1000) / 10; }));
  });
  res.clearContents();
  res.getRange(1, 1, 1, h2.length).setValues([h2]).setFontWeight('bold');
  if (r2.length) res.getRange(2, 1, r2.length, h2.length).setValues(r2);
  res.setFrozenRows(1);
  res.getRange(1, h2.length + 2).setValue('Updated at ' + new Date().toLocaleString('en-GB'));
}

function readAll_() {
  const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents:runQuery';
  const out = [];
  let cursor = '1970-01-01T00:00:00Z';
  while (true) {
    const body = { structuredQuery: {
      from: [{ collectionId: 'entries' }],
      where: { fieldFilter: { field: { fieldPath: 'updatedAt' }, op: 'GREATER_THAN', value: { timestampValue: cursor } } },
      orderBy: [{ field: { fieldPath: 'updatedAt' }, direction: 'ASCENDING' }], limit: 500 } };
    const resp = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(body),
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('Firestore: ' + resp.getContentText());
    const docs = JSON.parse(resp.getContentText()).filter(function (x) { return x.document; }).map(function (x) { return fromFields_(x.document.fields); });
    docs.forEach(function (d) { out.push(d); });
    if (docs.length < 500) break;
    cursor = docs[docs.length - 1].updatedAt;
  }
  return out;
}

function fromFields_(f) {
  const o = {};
  Object.keys(f || {}).forEach(function (k) { o[k] = val_(f[k]); });
  return o;
}
function val_(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val_);
  if ('mapValue' in v) return fromFields_(v.mapValue.fields);
  return null;
}
function round2_(n) { return Math.round(n * 100) / 100; }

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'syncNow') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncNow').timeBased().everyHours(1).create();
  syncNow();
}
