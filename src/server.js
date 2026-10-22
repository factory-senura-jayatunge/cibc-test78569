// @ts-check
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAccount, listAccounts } from './platform/accounts.js';
import * as investorsEdge from './lob/investors-edge/index.js';
import * as woodGundy from './lob/wood-gundy/index.js';
import * as pic from './lob/pic/index.js';
import * as privateBanking from './lob/private-banking/index.js';
import { createLogger, parseLevel } from './observability/logger.js';
import { PROMETHEUS_CONTENT_TYPE, createMetrics } from './observability/metrics.js';
import { REQUEST_ID_HEADER, requestContext } from './observability/request-context.js';

/** @typedef {import('./observability/logger.js').Logger} Logger */
/** @typedef {ReturnType<typeof createMetrics>} Metrics */
/** @typedef {{ status?: number, contentType?: string, body: unknown }} RouteResult */
/** @typedef {{ req: http.IncomingMessage, url: URL, params: Record<string, string>, metrics: Metrics }} RouteContext */
/** @typedef {{ method: string, path: string, handle: (context: RouteContext) => RouteResult | Promise<RouteResult> }} Route */

/** @type {Record<string, { statementFor: (accountId: string, quarter: string) => unknown }>} */
const LOBS = {
  'investors-edge': investorsEdge,
  'wood-gundy': woodGundy,
  pic,
  'private-banking': privateBanking,
};
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
/** @type {Record<string, string>} */
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};
const JSON_TYPE = 'application/json; charset=utf-8';

/** @param {http.IncomingMessage} req */
async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/** @param {{ id: string, lob: string, holder: string, type: string }} account */
function summarize(account) {
  return { id: account.id, lob: account.lob, holder: account.holder, type: account.type };
}

/** @type {Route[]} */
const ROUTES = [
  { method: 'GET', path: '/api/health', handle: () => ({ body: { status: 'ok' } }) },
  {
    method: 'GET',
    path: '/api/metrics',
    handle: ({ metrics }) => ({ contentType: PROMETHEUS_CONTENT_TYPE, body: metrics.render() }),
  },
  {
    method: 'GET',
    path: '/api/accounts',
    handle: ({ url }) => ({ body: { accounts: listAccounts(url.searchParams.get('lob') ?? undefined).map(summarize) } }),
  },
  {
    method: 'GET',
    path: '/api/statements/:accountId',
    handle: ({ url, params }) => {
      const account = getAccount(params.accountId);
      const quarter = url.searchParams.get('quarter') ?? '2026-Q3';
      return { body: { statement: LOBS[account.lob].statementFor(params.accountId, quarter) } };
    },
  },
  {
    method: 'POST',
    path: '/api/orders/preview',
    handle: async ({ req }) => ({ body: { order: investorsEdge.previewOrder(await readJson(req)) } }),
  },
  {
    method: 'GET',
    path: '/api/credit/:accountId',
    handle: ({ params }) => ({ body: { credit: privateBanking.creditSummary(params.accountId) } }),
  },
  {
    method: 'GET',
    path: '/api/mandates/:accountId/drift',
    handle: ({ params }) => ({ body: { drift: pic.driftReport(params.accountId) } }),
  },
];

/**
 * @param {string} method
 * @param {string[]} segments
 * @returns {{ route: Route, params: Record<string, string> } | undefined}
 */
function matchRoute(method, segments) {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const template = route.path.split('/').filter(Boolean);
    if (template.length !== segments.length) continue;
    /** @type {Record<string, string>} */
    const params = {};
    const matches = template.every((part, index) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = segments[index];
        return true;
      }
      return part === segments[index];
    });
    if (matches) return { route, params };
  }
  return undefined;
}

/**
 * @param {unknown} error
 * @returns {{ status: number, message: string }}
 */
function errorResponse(error) {
  const code = error instanceof Error ? Reflect.get(error, 'code') : undefined;
  const message = error instanceof Error ? error.message : String(error);
  if (code === 'NOT_FOUND') return { status: 404, message };
  if (code === 'INVALID_ORDER' || error instanceof RangeError || error instanceof SyntaxError) return { status: 400, message };
  return { status: 500, message: 'Internal error' };
}

/** @param {string} pathname @returns {Promise<{ status: number, contentType: string, body: string | Buffer }>} */
async function readStatic(pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normalize(join(PUBLIC_DIR, relativePath));
  const notFound = { status: 404, contentType: JSON_TYPE, body: JSON.stringify({ error: 'Not found' }) };
  if (!file.startsWith(PUBLIC_DIR)) return notFound;
  try {
    return { status: 200, contentType: CONTENT_TYPES[extname(file)] ?? 'application/octet-stream', body: await readFile(file) };
  } catch {
    return notFound;
  }
}

/**
 * @param {http.IncomingMessage} req
 * @param {URL} url
 * @param {Metrics} metrics
 * @returns {Promise<{ route: string, status: number, contentType: string, body: string | Buffer, error?: unknown }>}
 */
async function dispatch(req, url, metrics) {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'api') return { route: 'static', ...(await readStatic(url.pathname)) };
  const match = matchRoute(req.method ?? 'GET', segments);
  if (!match) return { route: 'unmatched', status: 404, contentType: JSON_TYPE, body: JSON.stringify({ error: 'Not found' }) };
  try {
    const result = await match.route.handle({ req, url, params: match.params, metrics });
    const body = result.contentType ? String(result.body) : JSON.stringify(result.body);
    return { route: match.route.path, status: result.status ?? 200, contentType: result.contentType ?? JSON_TYPE, body };
  } catch (error) {
    const { status, message } = errorResponse(error);
    return { route: match.route.path, status, contentType: JSON_TYPE, body: JSON.stringify({ error: message }), error };
  }
}

/**
 * @param {{ logger?: Logger, metrics?: Metrics }} [options]
 */
export function createServer({ logger = createLogger({ level: parseLevel(process.env.LOG_LEVEL, 'silent') }), metrics = createMetrics() } = {}) {
  return http.createServer(async (req, res) => {
    const started = process.hrtime.bigint();
    const { requestId, traceId } = requestContext(req.headers);
    const log = logger.child(traceId ? { requestId, traceId } : { requestId });
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';
    const result = await dispatch(req, url, metrics);

    res.writeHead(result.status, { 'content-type': result.contentType, [REQUEST_ID_HEADER]: requestId });
    res.end(result.body);

    const durationSeconds = Number(process.hrtime.bigint() - started) / 1e9;
    metrics.observeRequest({ method, route: result.route, status: result.status, durationSeconds });
    const fields = { method, route: result.route, status: result.status, durationMs: Math.round(durationSeconds * 1e5) / 100 };
    if (result.status >= 500) log.error('request failed', { ...fields, err: result.error });
    else log.info('request completed', fields);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const logger = createLogger({ level: parseLevel(process.env.LOG_LEVEL, 'info') });
  const port = Number(process.env.PORT ?? 3000);
  const server = createServer({ logger });
  server.listen(port, () => logger.info('OBR synthetic model listening', { url: `http://localhost:${port}` }));
  // Close cleanly so `node --cpu-prof` (npm run profile) can write its profile on exit.
  for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
    process.once(signal, () => {
      logger.info('shutting down', { signal });
      server.close(() => process.exit(0));
      server.closeAllConnections();
    });
  }
}
