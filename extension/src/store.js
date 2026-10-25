// Local storage: chrome.storage.local inside the extension, localStorage outside it (web demo).
const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

export const store = {
  async get(key, fallback = null) {
    try {
      if (hasChrome) {
        const r = await chrome.storage.local.get(key);
        return r[key] ?? fallback;
      }
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  async set(key, value) {
    try {
      if (hasChrome) return await chrome.storage.local.set({ [key]: value });
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* storage unavailable: keep going in memory */ }
  },
  async remove(key) {
    try {
      if (hasChrome) return await chrome.storage.local.remove(key);
      localStorage.removeItem(key);
    } catch { /* ignore */ }
  },
};
