// Firestore adapter over REST. Same interface as the demo adapter.
import { CONFIG } from './config.js';
import { getIdToken, currentUser } from './auth.js';

const DB = () => `projects/${CONFIG.FIREBASE.projectId}/databases/(default)/documents`;
const BASE = () => `https://firestore.googleapis.com/v1/${DB()}`;

// ---- JS <-> Firestore Value conversion ----
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  throw new Error('Unsupported type');
}
const toFields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toValue(v)]));
function fromValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}
const fromFields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fromValue(v)]));
const fromDoc = (d) => ({ id: d.name.split('/').pop(), ...fromFields(d.fields || {}) });

async function call(url, opts = {}) {
  const token = await getIdToken();
  const r = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const msg = j?.error?.message || `Erro ${r.status}`;
    const e = new Error(r.status === 403 ? 'You do not have permission for this action.' : msg);
    e.status = r.status;
    throw e;
  }
  return r.status === 204 ? null : r.json();
}

const ts = (f) => ({ fieldPath: f, setToServerValue: 'REQUEST_TIME' });
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);

export const firestoreAdapter = {
  name: 'firebase',

  async isAdmin() {
    const u = await currentUser();
    if (!u) return false;
    try { await call(`${BASE()}/admins/${encodeURIComponent(u.email)}`); return true; }
    catch { return false; }
  },

  async create(entry) {
    const u = await currentUser();
    const id = newId();
    const data = { ...entry, deleted: false, createdBy: u.email, updatedBy: u.email };
    await call(`${BASE()}:commit`, {
      method: 'POST',
      body: JSON.stringify({
        writes: [{
          update: { name: `${DB()}/entries/${id}`, fields: toFields(data) },
          currentDocument: { exists: false },
          updateTransforms: [ts('createdAt'), ts('updatedAt')],
        }],
      }),
    });
    return id;
  },

  /** Admin: replaces editable fields (keeps author and creation date). */
  async update(id, patch) {
    const u = await currentUser();
    const data = { ...patch, updatedBy: u.email };
    await call(`${BASE()}:commit`, {
      method: 'POST',
      body: JSON.stringify({
        writes: [{
          update: { name: `${DB()}/entries/${id}`, fields: toFields(data) },
          updateMask: { fieldPaths: Object.keys(data) },
          currentDocument: { exists: true },
          updateTransforms: [ts('updatedAt')],
        }],
      }),
    });
  },

  async remove(id) { return this.update(id, { deleted: true }); },

  /** Documents changed after `sinceIso` (incremental sync = few reads). */
  async changedSince(sinceIso) {
    const out = [];
    let cursor = sinceIso || '1970-01-01T00:00:00Z';
    // paginate 500 at a time
    for (;;) {
      const res = await call(`${BASE()}:runQuery`, {
        method: 'POST',
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'entries' }],
            where: { fieldFilter: { field: { fieldPath: 'updatedAt' }, op: 'GREATER_THAN', value: { timestampValue: cursor } } },
            orderBy: [{ field: { fieldPath: 'updatedAt' }, direction: 'ASCENDING' }],
            limit: 500,
          },
        }),
      });
      const docs = (res || []).filter((x) => x.document).map((x) => fromDoc(x.document));
      out.push(...docs);
      if (docs.length < 500) break;
      cursor = docs[docs.length - 1].updatedAt;
    }
    return out;
  },
};
