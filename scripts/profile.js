#!/usr/bin/env node
// @ts-check
// CPU-profiles the API under a short synthetic load and prints the hottest functions.
// Writes a V8 .cpuprofile to out/profiles/ that opens in Chrome DevTools (Performance tab) or
// speedscope.app as a flame graph. Usage: node scripts/profile.js [--requests 2000]
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, relative } from 'node:path';
import { ROOT } from './lib/graph.js';
import { flagValue } from './lib/cli.js';

const PROFILE_DIR = join(ROOT, 'out/profiles');
const REQUESTS = Number(flagValue('--requests') ?? 2000);
const PATHS = [
  '/api/accounts',
  '/api/statements/IE-58210043',
  '/api/statements/WG-30115520',
  '/api/statements/PIC-77004101',
  '/api/statements/PB-12003885',
  '/api/credit/PB-12003885',
  '/api/mandates/PIC-77004101/drift',
];

/** @returns {Promise<number>} */
const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });

/** @param {string} base */
async function waitForHealth(base) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {
      // Server not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Server did not become healthy within 5 s');
}

/**
 * @typedef {{ id: number, callFrame: { functionName: string, url: string, lineNumber: number }, hitCount?: number }} ProfileNode
 * @param {string} file
 */
function hottestFunctions(file) {
  const profile = /** @type {{ nodes: ProfileNode[] }} */ (JSON.parse(readFileSync(file, 'utf8')));
  const total = profile.nodes.reduce((sum, node) => sum + (node.hitCount ?? 0), 0) || 1;
  /** @type {Map<string, number>} */
  const byFunction = new Map();
  for (const { callFrame, hitCount = 0 } of profile.nodes) {
    if (!callFrame.url.includes('/src/')) continue;
    const key = `${callFrame.functionName || '(anonymous)'}  ${callFrame.url.replace(/^.*\/src\//, 'src/')}:${callFrame.lineNumber + 1}`;
    byFunction.set(key, (byFunction.get(key) ?? 0) + hitCount);
  }
  return [...byFunction]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, hits]) => `  ${((hits / total) * 100).toFixed(1).padStart(5)}%  ${key}`);
}

mkdirSync(PROFILE_DIR, { recursive: true });
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['--cpu-prof', `--cpu-prof-dir=${PROFILE_DIR}`, 'src/server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(port), LOG_LEVEL: 'warn' },
  stdio: 'inherit',
});
const exited = new Promise((resolve) => child.once('exit', resolve));

const started = Date.now();
await waitForHealth(base);
for (let i = 0; i < REQUESTS; i += 1) await (await fetch(`${base}${PATHS[i % PATHS.length]}`)).arrayBuffer();
const elapsed = Date.now() - started;
child.kill('SIGTERM');
await exited;

const [latest] = readdirSync(PROFILE_DIR)
  .filter((name) => name.endsWith('.cpuprofile'))
  .map((name) => join(PROFILE_DIR, name))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
if (!latest) {
  console.error('No .cpuprofile was written.');
  process.exit(1);
}
console.log(`\n${REQUESTS} requests in ${elapsed} ms (${((REQUESTS / elapsed) * 1000).toFixed(0)} req/s).`);
console.log(`Profile: ${relative(ROOT, latest)}  (open in Chrome DevTools > Performance, or speedscope.app)\n`);
console.log('Hottest OBR functions by self time:');
console.log(hottestFunctions(latest).join('\n') || '  (no samples in src/)');
