import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

let server;
let base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

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
