// Injects the side drawer (a tab that opens/closes) into the back-office page.
// It never reads or changes the back office: it only draws an isolated extension iframe.
(() => {
  if (window.top !== window || window.__riskPanel) return; // top window only, once
  window.__riskPanel = true;

  const W = 400;
  const EXT_ORIGIN = new URL(chrome.runtime.getURL('')).origin;
  const host = document.createElement('div');
  host.id = 'risk-savings-root';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap { position: fixed; top: 0; right: 0; height: 100vh; z-index: 2147483646; display: flex;
        transform: translateX(${W}px); transition: transform .25s ease; font-family: system-ui, sans-serif; }
      .wrap.open { transform: translateX(0); }
      .handle { align-self: center; width: 34px; height: 120px; margin-right: -1px; border: 0; cursor: pointer;
        background: #0E1116; color: #34D399; border-radius: 10px 0 0 10px; box-shadow: -4px 0 16px rgba(0,0,0,.35);
        writing-mode: vertical-rl; transform: rotate(180deg); font: 700 12px system-ui, sans-serif; letter-spacing: .08em; }
      .handle:hover { color: #fff; }
      iframe { width: ${W}px; height: 100vh; border: 0; background: #0E1116; box-shadow: -8px 0 24px rgba(0,0,0,.45); }
    </style>
    <div class="wrap">
      <button class="handle" title="Risk Savings (Alt+R)">€ SAVINGS</button>
      <iframe title="Risk Savings" allow="clipboard-write"></iframe>
    </div>`;
  const wrap = shadow.querySelector('.wrap');
  const frame = shadow.querySelector('iframe');
  let loaded = false;

  function toggle(force) {
    const open = force ?? !wrap.classList.contains('open');
    if (open && !loaded) { // load on first open only (saves requests)
      frame.src = chrome.runtime.getURL(`panel.html?host=${encodeURIComponent(location.hostname)}`);
      loaded = true;
    }
    wrap.classList.toggle('open', open);
  }

  shadow.querySelector('.handle').addEventListener('click', () => toggle());
  window.addEventListener('message', (e) => {
    if (e.origin === EXT_ORIGIN && e.source === frame.contentWindow && e.data?.type === 'risk-panel:close') toggle(false);
  });
  window.addEventListener('keydown', (e) => { if (e.altKey && (e.key === 'r' || e.key === 'R')) toggle(); });
  chrome.runtime.onMessage.addListener((m) => { if (m?.type === 'risk-panel:toggle') toggle(); });

  (document.body || document.documentElement).appendChild(host);
})();
