import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PORT || 8787);
http.createServer(async (request, response) => {
  try {
    const html = await readFile(join(root, 'dist/index.html'));
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(html);
  } catch (error) { response.writeHead(500); response.end(String(error)); }
}).listen(port, '127.0.0.1', () => console.log(`Ice Slam game: http://127.0.0.1:${port}`));
