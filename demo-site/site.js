// Simulated back office. Brand comes from the subdomain (kestrel.localhost) or ?brand=kestrel.
// All names and numbers are invented.
const BRANDS = {
  kestrel: { name: 'Kestrel Bet', color: '#38BDF8', bg: '#0B1622', cur: 'EUR' },
  lynx: { name: 'Lynx Casino', color: '#A78BFA', bg: '#140F22', cur: 'BRL' },
  orca: { name: 'Orca Slots', color: '#2DD4BF', bg: '#08191A', cur: 'EUR' },
  vega: { name: 'Vega Play', color: '#FBBF24', bg: '#1A1408', cur: 'BRL' },
  nimbus: { name: 'Nimbus Crypto', color: '#F472B6', bg: '#1C0B16', cur: 'USDT' },
};
const params = new URLSearchParams(location.search);
const sub = location.hostname.endsWith('.localhost') ? location.hostname.split('.')[0] : '';
const id = BRANDS[params.get('brand')] ? params.get('brand') : BRANDS[sub] ? sub : 'kestrel';
const b = BRANDS[id];
const root = document.documentElement.style;
root.setProperty('--brand', b.color); root.setProperty('--brand-bg', b.bg);
document.title = `${b.name} · Back Office (simulated)`;
document.getElementById('bname').textContent = b.name;
const base = location.pathname.replace(/[^/]*$/, '');
const extBase = new URL('../extension/', location.origin + base).href;
document.getElementById('logo').src = `${extBase}assets/logos/${id}.svg`;

const signals = ['Device shared by 4 accounts', 'Same IP as 3 players', 'Bonus-only deposits', 'Chargeback history', 'Matched KYC selfie'];
const status = [['Under review', 'rev'], ['Closed', 'cl'], ['Cleared', 'ok']];
let s = id.length * 97;
const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
const fmt = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
document.getElementById('rows').replaceChildren(...Array.from({ length: 8 }, () => {
  const tr = document.createElement('tr');
  const st = status[Math.floor(rnd() * 3)];
  const cells = [`player_${1000 + Math.floor(rnd() * 9000)}`, signals[Math.floor(rnd() * signals.length)], `${fmt.format(50 + rnd() * 2500)} ${b.cur}`];
  for (const c of cells) { const td = document.createElement('td'); td.textContent = c; tr.append(td); }
  const td = document.createElement('td'); const sp = document.createElement('span');
  sp.className = `st ${st[1]}`; sp.textContent = st[0]; td.append(sp); tr.append(td);
  return tr;
}));

// No extension installed (e.g. the GitHub Pages live demo)? Draw the same drawer with the panel page.
setTimeout(() => {
  if (document.getElementById('risk-savings-root')) return;
  const W = 400;
  const wrap = document.createElement('div');
  wrap.id = 'risk-savings-fallback';
  wrap.style.cssText = `position:fixed;top:0;right:0;height:100vh;z-index:9999;display:flex;transform:translateX(${W}px);transition:transform .25s ease`;
  const handle = document.createElement('button');
  handle.textContent = '€ SAVINGS'; handle.title = 'Risk Savings (Alt+R)';
  handle.style.cssText = 'align-self:center;width:34px;height:120px;border:0;cursor:pointer;background:#0E1116;color:#34D399;border-radius:10px 0 0 10px;writing-mode:vertical-rl;transform:rotate(180deg);font:700 12px system-ui,sans-serif;letter-spacing:.08em';
  const frame = document.createElement('iframe');
  frame.title = 'Risk Savings';
  frame.style.cssText = `width:${Math.min(W, innerWidth - 34)}px;height:100vh;border:0;background:#0E1116;box-shadow:-8px 0 24px rgba(0,0,0,.45)`;
  let loaded = false;
  const toggle = (force) => {
    const open = force ?? wrap.style.transform !== 'translateX(0px)';
    if (open && !loaded) { frame.src = `${extBase}panel.html?host=${id}.localhost`; loaded = true; }
    wrap.style.transform = open ? 'translateX(0px)' : `translateX(${W}px)`;
  };
  handle.onclick = () => toggle();
  addEventListener('keydown', (e) => { if (e.altKey && e.key.toLowerCase() === 'r') toggle(); });
  addEventListener('message', (e) => { if (e.source === frame.contentWindow && e.data?.type === 'risk-panel:close') toggle(false); });
  wrap.append(handle, frame); document.body.append(wrap);
  if (params.has('open')) toggle(true);
}, 800);
