// Service worker: toolbar icon click.
// - On a back office: opens/closes the side drawer.
// - On any other page: opens the panel in its own window (no access to the site).
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'risk-panel:toggle' });
      return;
    }
  } catch { /* tab without drawer */ }
  chrome.windows.create({ url: chrome.runtime.getURL('panel.html'), type: 'popup', width: 420, height: 760 });
});

// Google sign-in: the flow runs HERE (single owner), not in the panel iframe.
// If the panel is closed/reloaded mid sign-in, the flow does not get stuck,
// and repeated clicks reuse the same flow instead of opening another one
// (avoids "Only one web auth flow is allowed at a time").
let authFlow = null;
function runAuthFlow(url) {
  if (!authFlow) {
    authFlow = chrome.identity.launchWebAuthFlow({ url, interactive: true })
      .finally(() => { authFlow = null; });
  }
  return authFlow;
}
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type !== 'risk-auth:flow') return;
  runAuthFlow(msg.url)
    .then((back) => reply({ ok: true, back }))
    .catch((e) => reply({ ok: false, error: String(e?.message || e) }));
  return true; // async response
});
