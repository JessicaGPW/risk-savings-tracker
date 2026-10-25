// Zero-dependency static server for the demo.
// Open http://kestrel.localhost:8080/demo-site/ (also lynx, orca, vega, nimbus).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const PORT = Number(process.env.PORT) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.mp4': 'video/mp4' };

createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    if (path.includes('..')) throw new Error('bad path');
    let file = join(ROOT, path || 'index.html');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`Demo running. Open one of the simulated back offices:`);
  for (const b of ['kestrel', 'lynx', 'orca', 'vega', 'nimbus']) console.log(`  http://${b}.localhost:${PORT}/demo-site/`);
});
