// @ts-check
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, loadLocalEnv } from '../src/server.js';
import { MAX_BYTES, findOversized } from '../scripts/check-file-size.js';
import { createLogger, maskAccountIds, parseLevel, scrub } from '../src/observability/logger.js';
import { createMetrics } from '../src/observability/metrics.js';
import { requestContext } from '../src/observability/request-context.js';

/** @type {string[]} */
const lines = [];
const logger = createLogger({ level: 'info', write: (line) => lines.push(line), now: () => new Date('2026-10-01T00:00:00Z') });
/** @type {import('node:http').Server} */
let server;
let base = '';

before(async () => {
  server = createServer({ logger });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
});

after(() => new Promise((resolve) => server.close(() => resolve(undefined))));

test('health endpoint answers ok', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('every line of business renders a statement through the API', async () => {
  for (const id of ['IE-58210043', 'WG-30115520', 'PIC-77004101', 'PB-12003885']) {
    const response = await fetch(`${base}/api/statements/${id}?quarter=2026-Q3`);
    assert.equal(response.status, 200, id);
    const { statement } = await response.json();
    assert.equal(statement.accountId, id);
  }
});

test('unknown account returns 404', async () => {
  const response = await fetch(`${base}/api/statements/XX-0000`);
  assert.equal(response.status, 404);
});

test('invalid order returns 400', async () => {
  const response = await fetch(`${base}/api/orders/preview`, {
    method: 'POST',
    body: JSON.stringify({ accountId: 'IE-58210043', symbol: 'NSE-CDNEQ', side: 'buy', qty: 0 }),
  });
  assert.equal(response.status, 400);
});

test('portal page is served', async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /OBR/);
});

/** @returns {Record<string, unknown>[]} */
const logEntries = () => lines.map((line) => JSON.parse(line));

test('maskAccountIds keeps the prefix and last four digits', () => {
  assert.equal(maskAccountIds('Unknown account WG-30115520'), 'Unknown account WG-****5520');
  assert.equal(maskAccountIds('PIC-77004101 and IE-58210043'), 'PIC-****4101 and IE-****0043');
  assert.equal(maskAccountIds('NSE-CDNEQ'), 'NSE-CDNEQ');
});

test('scrub redacts client names and masks nested account numbers', () => {
  const scrubbed = scrub({ holder: 'Meera Singh', detail: { accountId: 'WG-30115520', ids: ['PB-12003885'] }, Authorization: 'Bearer x' });
  assert.deepEqual(scrubbed, {
    holder: '[REDACTED]',
    detail: { accountId: 'WG-****5520', ids: ['PB-****3885'] },
    Authorization: '[REDACTED]',
  });
});

test('scrub keeps error name, message, and code but masks account numbers in them', () => {
  const error = Object.assign(new Error('Unknown account WG-30115520'), { code: 'NOT_FOUND' });
  const scrubbed = /** @type {Record<string, unknown>} */ (scrub(error));
  assert.equal(scrubbed.name, 'Error');
  assert.equal(scrubbed.message, 'Unknown account WG-****5520');
  assert.equal(scrubbed.code, 'NOT_FOUND');
});

test('logger writes one JSON object per line and respects the level', () => {
  /** @type {string[]} */
  const out = [];
  const log = createLogger({ level: 'warn', write: (line) => out.push(line), now: () => new Date('2026-10-01T00:00:00Z') });
  log.info('ignored');
  log.child({ requestId: 'r-1' }).warn('slow statement', { accountId: 'IE-58210043' });
  assert.equal(out.length, 1);
  assert.ok(out[0].endsWith('\n'));
  assert.deepEqual(JSON.parse(out[0]), {
    time: '2026-10-01T00:00:00.000Z',
    level: 'warn',
    msg: 'slow statement',
    requestId: 'r-1',
    accountId: 'IE-****0043',
  });
});

test('parseLevel accepts known levels and falls back otherwise', () => {
  assert.equal(parseLevel('DEBUG', 'info'), 'debug');
  assert.equal(parseLevel('verbose', 'info'), 'info');
  assert.equal(parseLevel(undefined, 'silent'), 'silent');
});

test('requestContext reuses a safe X-Request-ID and reads the W3C trace ID', () => {
  const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
  assert.deepEqual(requestContext({ 'x-request-id': 'abc-123', traceparent: `00-${traceId}-00f067aa0ba902b7-01` }), {
    requestId: 'abc-123',
    traceId,
  });
  assert.deepEqual(
    requestContext({ 'x-request-id': 'bad id\nwith newline' }, () => 'generated'),
    { requestId: 'generated' },
  );
  assert.deepEqual(
    requestContext({ traceparent: `00-${'0'.repeat(32)}-00f067aa0ba902b7-01` }, () => 'generated'),
    { requestId: 'generated' },
  );
});

test('metrics render counters and histograms in Prometheus text format', () => {
  const metrics = createMetrics({ uptimeSeconds: () => 12, memoryUsage: () => /** @type {NodeJS.MemoryUsage} */ ({ rss: 100, heapUsed: 50 }) });
  metrics.observeRequest({ method: 'GET', route: '/api/health', status: 200, durationSeconds: 0.02 });
  metrics.observeRequest({ method: 'GET', route: '/api/health', status: 200, durationSeconds: 3 });
  const text = metrics.render();
  assert.match(text, /^http_requests_total\{method="GET",route="\/api\/health",status="200"\} 2$/m);
  assert.match(text, /^http_request_duration_seconds_bucket\{method="GET",route="\/api\/health",le="0.025"\} 1$/m);
  assert.match(text, /^http_request_duration_seconds_bucket\{method="GET",route="\/api\/health",le="\+Inf"\} 2$/m);
  assert.match(text, /^http_request_duration_seconds_count\{method="GET",route="\/api\/health"\} 2$/m);
  assert.match(text, /^process_uptime_seconds 12$/m);
});

test('every response carries an X-Request-ID, echoing a safe incoming one', async () => {
  const echoed = await fetch(`${base}/api/health`, { headers: { 'x-request-id': 'trace-me-1' } });
  assert.equal(echoed.headers.get('x-request-id'), 'trace-me-1');
  const generated = await fetch(`${base}/api/accounts`);
  assert.match(generated.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
});

test('request logs use the route template and never the raw account number or client name', async () => {
  lines.length = 0;
  const response = await fetch(`${base}/api/statements/WG-30115520`, { headers: { 'x-request-id': 'log-check' } });
  assert.equal(response.status, 200);
  const entry = logEntries().find((candidate) => candidate.requestId === 'log-check');
  assert.ok(entry, 'request log entry is missing');
  assert.equal(entry.msg, 'request completed');
  assert.equal(entry.route, '/api/statements/:accountId');
  assert.equal(entry.status, 200);
  assert.equal(typeof entry.durationMs, 'number');
  const raw = lines.join('');
  assert.ok(!raw.includes('30115520'), 'account number leaked into logs');
  assert.ok(!raw.includes('Meera Singh'), 'client name leaked into logs');
});

test('GET /api/metrics exposes request counts by route template', async () => {
  await fetch(`${base}/api/credit/PB-12003885`);
  const response = await fetch(`${base}/api/metrics`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/plain; version=0\.0\.4/);
  const text = await response.text();
  assert.match(text, /http_requests_total\{method="GET",route="\/api\/credit\/:accountId",status="200"\} \d+/);
  assert.ok(!text.includes('12003885'), 'account number leaked into metrics');
});

test('unknown routes are counted under one label to keep metric cardinality bounded', async () => {
  await fetch(`${base}/api/nope/IE-58210043`);
  const text = await (await fetch(`${base}/api/metrics`)).text();
  assert.match(text, /http_requests_total\{method="GET",route="unmatched",status="404"\} \d+/);
  assert.ok(!text.includes('58210043'));
});

test('READINESS-1 AC1: account numbers are masked next to underscores and other word characters', async () => {
  assert.equal(maskAccountIds('request_WG-30115520'), 'request_WG-****5520');
  assert.equal(maskAccountIds('WG-30115520_retry'), 'WG-****5520_retry');
  assert.equal(maskAccountIds('xPB-12003885x'), 'xPB-****3885x');
  lines.length = 0;
  const response = await fetch(`${base}/api/health`, { headers: { 'x-request-id': 'request_WG-30115520' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-request-id'), 'request_WG-30115520', 'request ID was replaced, so masking was not exercised');
  assert.ok(lines.length > 0, 'request was not logged');
  assert.ok(!lines.join('').includes('30115520'), 'account number in a request ID leaked into logs');
});

/** @param {(repo: string) => void} body */
function withTempRepo(body) {
  const repo = mkdtempSync(join(tmpdir(), 'obr-file-size-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: repo });
    body(repo);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

test('READINESS-1 AC2: the file-size check measures files whose names Git would quote', () => {
  withTempRepo((repo) => {
    writeFileSync(join(repo, 'résumé.bin'), Buffer.alloc(MAX_BYTES + 1));
    writeFileSync(join(repo, 'small.txt'), 'ok');
    assert.deepEqual(
      findOversized({ cwd: repo }).oversized.map(({ file }) => file),
      ['résumé.bin'],
    );
  });
});

test('READINESS-1 AC3: --staged measures the staged blob, not the working copy', () => {
  withTempRepo((repo) => {
    const file = join(repo, 'data dump.bin');
    writeFileSync(file, Buffer.alloc(MAX_BYTES + 1));
    execFileSync('git', ['add', '.'], { cwd: repo });
    writeFileSync(file, 'shrunk after staging');
    assert.deepEqual(findOversized({ cwd: repo, staged: true }).oversized, [{ file: 'data dump.bin', bytes: MAX_BYTES + 1 }]);

    writeFileSync(file, 'small');
    execFileSync('git', ['add', '.'], { cwd: repo });
    writeFileSync(file, Buffer.alloc(MAX_BYTES + 1));
    assert.deepEqual(findOversized({ cwd: repo, staged: true }).oversized, []);
  });
});

test('READINESS-1 AC4: loadLocalEnv reads .env without overriding the environment', () => {
  const dir = mkdtempSync(join(tmpdir(), 'obr-env-'));
  const file = join(dir, '.env');
  writeFileSync(file, 'OBR_TEST_FROM_FILE=file\nOBR_TEST_ALREADY_SET=file\n');
  process.env.OBR_TEST_ALREADY_SET = 'shell';
  try {
    loadLocalEnv(join(dir, 'missing.env'));
    assert.equal(process.env.OBR_TEST_FROM_FILE, undefined);
    loadLocalEnv(file);
    assert.equal(process.env.OBR_TEST_FROM_FILE, 'file');
    assert.equal(process.env.OBR_TEST_ALREADY_SET, 'shell');
  } finally {
    delete process.env.OBR_TEST_FROM_FILE;
    delete process.env.OBR_TEST_ALREADY_SET;
    rmSync(dir, { recursive: true, force: true });
  }
});
