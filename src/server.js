import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAccount, listAccounts } from './platform/accounts.js';
import * as investorsEdge from './lob/investors-edge/index.js';
import * as woodGundy from './lob/wood-gundy/index.js';
import * as pic from './lob/pic/index.js';
import * as privateBanking from './lob/private-banking/index.js';

const LOBS = {
  'investors-edge': investorsEdge,
  'wood-gundy': woodGundy,
  pic,
  'private-banking': privateBanking,
};
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function summarize(account) {
  return { id: account.id, lob: account.lob, holder: account.holder, type: account.type };
}

async function routeApi(req, res, url, [resource, id, action]) {
  if (req.method === 'GET' && resource === 'health') return sendJson(res, 200, { status: 'ok' });
  if (req.method === 'GET' && resource === 'accounts' && !id) {
    return sendJson(res, 200, { accounts: listAccounts(url.searchParams.get('lob') ?? undefined).map(summarize) });
  }
  if (req.method === 'GET' && resource === 'statements' && id) {
    const account = getAccount(id);
    const quarter = url.searchParams.get('quarter') ?? '2026-Q3';
    return sendJson(res, 200, { statement: LOBS[account.lob].statementFor(id, quarter) });
  }
  if (req.method === 'POST' && resource === 'orders' && id === 'preview') {
    return sendJson(res, 200, { order: investorsEdge.previewOrder(await readJson(req)) });
  }
  if (req.method === 'GET' && resource === 'credit' && id) {
    return sendJson(res, 200, { credit: privateBanking.creditSummary(id) });
  }
  if (req.method === 'GET' && resource === 'mandates' && id && action === 'drift') {
    return sendJson(res, 200, { drift: pic.driftReport(id) });
  }
  return sendJson(res, 404, { error: 'Not found' });
}

async function serveStatic(res, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normalize(join(PUBLIC_DIR, relativePath));
  if (!file.startsWith(PUBLIC_DIR)) return sendJson(res, 404, { error: 'Not found' });
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    try {
      if (parts[0] === 'api') return await routeApi(req, res, url, parts.slice(1));
      return await serveStatic(res, url.pathname);
    } catch (error) {
      if (error.code === 'NOT_FOUND') return sendJson(res, 404, { error: error.message });
      if (error.code === 'INVALID_ORDER' || error instanceof RangeError || error instanceof SyntaxError) {
        return sendJson(res, 400, { error: error.message });
      }
      return sendJson(res, 500, { error: 'Internal error' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createServer().listen(port, () => console.log(`OBR synthetic model listening on http://localhost:${port}`));
}
