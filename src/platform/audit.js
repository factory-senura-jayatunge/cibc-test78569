const LOG = [];

export function record(event, accountId, detail = {}) {
  const entry = { at: new Date().toISOString(), event, accountId, detail };
  LOG.push(entry);
  if (process.env.AUDIT_STDOUT === '1') {
    console.log(`[audit] ${event} account=${accountId} ${JSON.stringify(detail)}`);
  }
  return entry;
}

export function entries() {
  return LOG.map((entry) => ({ ...entry }));
}

export function clear() {
  LOG.length = 0;
}
