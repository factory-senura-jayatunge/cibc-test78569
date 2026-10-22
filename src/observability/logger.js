// @ts-check
// Structured JSON-lines logger. Every field passes through scrub() so client names and
// unmasked account numbers never reach the log (AGENTS.md, SECURITY.md).

/** @typedef {'debug' | 'info' | 'warn' | 'error' | 'silent'} LogLevel */
/** @typedef {Record<string, unknown>} LogFields */
/**
 * @typedef {object} Logger
 * @property {(msg: string, fields?: LogFields) => void} debug
 * @property {(msg: string, fields?: LogFields) => void} info
 * @property {(msg: string, fields?: LogFields) => void} warn
 * @property {(msg: string, fields?: LogFields) => void} error
 * @property {(bindings: LogFields) => Logger} child
 */

/** @type {Record<LogLevel, number>} */
const SEVERITY = { debug: 10, info: 20, warn: 30, error: 40, silent: Infinity };

// No word boundaries: `_` and digits count as word characters, so `request_WG-30115520` or
// `WG-30115520_retry` would slip past `\b` and be logged unmasked.
const ACCOUNT_ID = /([A-Z]{2,3})-(\d{4,})/g;
const REDACTED_KEYS = new Set(['holder', 'clientname', 'authorization', 'cookie', 'password', 'secret', 'token', 'apikey']);
const MAX_DEPTH = 6;

/**
 * Masks synthetic account numbers such as `WG-30115520` to `WG-****5520`.
 * @param {string} text
 */
export function maskAccountIds(text) {
  return text.replace(ACCOUNT_ID, (_match, prefix, digits) => `${prefix}-****${digits.slice(-4)}`);
}

/**
 * Returns a copy of a value that is safe to log: account numbers masked, sensitive keys redacted.
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
export function scrub(value, depth = 0) {
  if (typeof value === 'string') return maskAccountIds(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[Truncated]';
  if (value instanceof Error) return scrub({ name: value.name, message: value.message, code: Reflect.get(value, 'code'), stack: value.stack }, depth);
  if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : scrub(item, depth + 1)]),
  );
}

/**
 * @param {string | undefined} value
 * @param {LogLevel} fallback
 * @returns {LogLevel}
 */
export function parseLevel(value, fallback) {
  const level = value?.toLowerCase();
  return level && Object.hasOwn(SEVERITY, level) ? /** @type {LogLevel} */ (level) : fallback;
}

/**
 * @param {{ level?: LogLevel, bindings?: LogFields, write?: (line: string) => void, now?: () => Date }} [options]
 * @returns {Logger}
 */
export function createLogger({ level = 'info', bindings = {}, write = (line) => process.stdout.write(line), now = () => new Date() } = {}) {
  /** @param {Exclude<LogLevel, 'silent'>} entryLevel */
  const emit =
    (entryLevel) =>
    /** @param {string} msg @param {LogFields} [fields] */
    (msg, fields = {}) => {
      if (SEVERITY[entryLevel] < SEVERITY[level]) return;
      const entry = { time: now().toISOString(), level: entryLevel, msg, ...bindings, ...fields };
      write(`${JSON.stringify(scrub(entry))}\n`);
    };
  return {
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    child: (childBindings) => createLogger({ level, bindings: { ...bindings, ...childBindings }, write, now }),
  };
}
