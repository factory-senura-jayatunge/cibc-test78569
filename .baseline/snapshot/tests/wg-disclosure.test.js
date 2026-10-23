// @ts-check
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { feeDisclosureLetter } from '../src/lob/wood-gundy/index.js';
import { getLetterTemplate, LETTER_TEMPLATES } from '../src/lob/wood-gundy/letter-templates.js';
import { clear, entries } from '../src/platform/audit.js';

/** @type {import('node:http').Server} */
let server;
let baseUrl = '';

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(() => new Promise((resolve) => server.close(() => resolve(undefined))));

beforeEach(() => clear());

/**
 * @param {string} accountId
 * @param {unknown} payload
 */
async function postDisclosure(accountId, payload) {
  const response = await fetch(`${baseUrl}/api/advisory/${accountId}/fee-disclosure`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: response.status, json: /** @type {any} */ (await response.json()) };
}

test('WG-977 AC1: renders the catalogued annual fee disclosure letter with the account figures', async () => {
  const { status, json } = await postDisclosure('WG-30115520', { templateId: 'annual-fee-disclosure' });
  assert.equal(status, 200);
  assert.equal(json.letter.title, 'Annual advisory fee disclosure');
  assert.match(json.letter.body, /Dear Meera Singh,/);
  assert.match(json.letter.body, /account WG-30115520, advised by R\. Okafor/);
  assert.match(json.letter.body, /Household assets: 273600 CAD/);
  assert.match(json.letter.body, /Projected annual advisory fee: 4045 CAD/);
});

test('WG-977 AC1: the fee change notice renders from the module surface', () => {
  const letter = feeDisclosureLetter('WG-30115520', { templateId: 'fee-change-notice' });
  assert.equal(letter.title, 'Advisory fee schedule change notice');
  assert.match(letter.body, /schedule for account WG-30115520 changes next quarter/);
  assert.match(letter.body, /projected annual fee is 4045 CAD/);
});

test('WG-977 AC2: a draft letter renders with its own source and variable setting', async () => {
  const draft = { title: 'Ad-hoc fee note', source: 'Fee <%- letter.annualFee %> CAD for <%- letter.holder %>', variable: 'letter' };
  const { status, json } = await postDisclosure('WG-30115520', { draft });
  assert.equal(status, 200);
  assert.equal(json.letter.title, 'Ad-hoc fee note');
  assert.equal(json.letter.body, 'Fee 4045 CAD for Meera Singh');
});

test('WG-977 AC2: a draft without a variable setting uses the default data scope', () => {
  const letter = feeDisclosureLetter('WG-30115520', { draft: { source: 'Fee <%- annualFee %> CAD' } });
  assert.equal(letter.title, 'Draft advisory fee disclosure');
  assert.equal(letter.body, 'Fee 4045 CAD');
});

test('WG-977 AC3: non-advisory accounts, unknown accounts, unknown templates, and empty drafts are rejected', async () => {
  const wrongLob = await postDisclosure('IE-58210043', { templateId: 'annual-fee-disclosure' });
  assert.equal(wrongLob.status, 400);
  assert.match(wrongLob.json.error, /not a Wood Gundy advisory account/);

  const unknownAccount = await postDisclosure('XX-0000', { templateId: 'annual-fee-disclosure' });
  assert.equal(unknownAccount.status, 404);

  const unknownTemplate = await postDisclosure('WG-30115520', { templateId: 'no-such-letter' });
  assert.equal(unknownTemplate.status, 404);
  assert.match(unknownTemplate.json.error, /Unknown letter template/);

  const emptyDraft = await postDisclosure('WG-30115520', { draft: {} });
  assert.equal(emptyDraft.status, 400);
  assert.match(emptyDraft.json.error, /draft\.source/);
});

test('WG-977 AC4: the audit event masks the account number and never carries the client name', () => {
  feeDisclosureLetter('WG-30115520', { templateId: 'annual-fee-disclosure' });
  const [entry] = entries();
  assert.equal(entry.event, 'advisory.fee-disclosure.rendered');
  assert.equal(entry.accountId, 'WG-****5520');
  assert.deepEqual(entry.detail, { template: 'annual-fee-disclosure' });
  const raw = JSON.stringify(entries());
  assert.ok(!raw.includes('30115520'), 'unmasked account number in the audit log');
  assert.ok(!raw.includes('Meera Singh'), 'client name in the audit log');
});

test('WG-977 AC5: both catalogued letters are registered with their template settings', () => {
  assert.deepEqual(Object.keys(LETTER_TEMPLATES).sort(), ['annual-fee-disclosure', 'fee-change-notice']);
  for (const template of Object.values(LETTER_TEMPLATES)) {
    assert.equal(template.settings.variable, 'letter');
    assert.equal(getLetterTemplate(template.id), template);
  }
  assert.throws(() => getLetterTemplate('missing'), /Unknown letter template missing/);
});
