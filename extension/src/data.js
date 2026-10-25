// Data facade: picks the adapter (firebase/demo) and keeps a local cache with incremental sync.
import { CONFIG } from './config.js';
import { store } from './store.js';
import { firestoreAdapter } from './firestore.js';
import { demoAdapter } from './demo.js';

export const adapter = CONFIG.MODE === 'demo' ? demoAdapter : firestoreAdapter;

const C_ENTRIES = `cache:${adapter.name}:entries`;
const C_SINCE = `cache:${adapter.name}:since`;

/** Syncs only what changed since last time and returns all live entries. */
export async function sync() {
  const map = new Map(((await store.get(C_ENTRIES)) || []).map((e) => [e.id, e]));
  const since = await store.get(C_SINCE);
  const changed = await adapter.changedSince(since);
  let max = since || '';
  for (const e of changed) {
    map.set(e.id, e);
    if (e.updatedAt > max) max = e.updatedAt;
  }
  const list = [...map.values()];
  await store.set(C_ENTRIES, list);
  if (max) await store.set(C_SINCE, max);
  return list.filter((e) => !e.deleted);
}

export async function cached() {
  return ((await store.get(C_ENTRIES)) || []).filter((e) => !e.deleted);
}

export async function clearCache() {
  await store.remove(C_ENTRIES);
  await store.remove(C_SINCE);
}
