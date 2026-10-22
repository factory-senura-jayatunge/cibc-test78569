#!/usr/bin/env node
// @ts-check
// Runs regression suites from the catalogue and reports results with production-equivalent timings.
// --retries N reruns a failing suite up to N times. A suite that fails and then passes is reported
// as FLAKY in the console and as `flaky: true` on its result in out/regression.json, so
// instability is tracked instead of hidden.
// --fail-on-flaky turns a flaky result into a failed run.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson } from './lib/graph.js';
import { flagValue } from './lib/cli.js';

/** @typedef {import('./lib/graph.js').Catalog} Catalog */
/** @typedef {import('./lib/graph.js').Suite} Suite */
/** @typedef {import('./lib/graph.js').SuiteResult} SuiteResult */

const args = process.argv.slice(2);
const flag = flagValue;

const retries = Number(flag('--retries') ?? 0);
if (!Number.isInteger(retries) || retries < 0) {
  console.error('--retries must be a non-negative integer.');
  process.exit(2);
}
const failOnFlaky = args.includes('--fail-on-flaky');

const catalog = /** @type {Catalog} */ (readJson('regression/catalog.json'));
/** @type {Suite[]} */
let suites;
let mode;
if (args.includes('--all')) {
  suites = catalog.suites;
  mode = 'full regression';
} else if (flag('--suites')) {
  const ids = new Set(String(flag('--suites')).split(','));
  suites = catalog.suites.filter((suite) => ids.has(suite.id));
  mode = 'selected suites';
} else {
  const impactPath = flag('--from-impact') ?? 'out/impact.json';
  if (!existsSync(join(ROOT, impactPath))) {
    console.error(`No impact report at ${impactPath}. Run \`npm run impact\` first.`);
    process.exit(2);
  }
  const impact = /** @type {import('./lib/graph.js').ImpactResult} */ (readJson(impactPath));
  const ids = new Set(impact.selected.map((suite) => suite.id));
  suites = catalog.suites.filter((suite) => ids.has(suite.id));
  mode = `scoped by ${impactPath}`;
}

/** @param {Suite} suite */
const runSuite = (suite) => spawnSync(process.execPath, ['--test', '--test-reporter=spec', suite.file], { cwd: ROOT, encoding: 'utf8' });

/** @type {SuiteResult[]} */
const results = [];
const started = Date.now();
for (const suite of suites) {
  const t0 = Date.now();
  let attempts = 0;
  let passed = false;
  while (!passed && attempts <= retries) {
    attempts += 1;
    const run = runSuite(suite);
    passed = run.status === 0;
    if (!passed) console.log(`\n--- ${suite.id} failed (attempt ${attempts} of ${retries + 1}) ---\n${run.stdout}${run.stderr}`);
  }
  const flaky = passed && attempts > 1;
  results.push({ id: suite.id, owner: suite.owner, passed, flaky, attempts, localMs: Date.now() - t0, productionMinutes: suite.productionMinutes });
}

const fullMinutes = catalog.suites.reduce((total, suite) => total + suite.productionMinutes, 0);
const scopedMinutes = results.reduce((total, suite) => total + suite.productionMinutes, 0);
const failed = results.filter((result) => !result.passed);
const flaky = results.filter((result) => result.flaky).map((result) => result.id);
/** @param {SuiteResult} result */
const verdict = (result) => (result.flaky ? 'FLAKY' : result.passed ? 'PASS' : 'FAIL');

console.log(`\nRegression run: ${mode}\n`);
for (const result of results) {
  console.log(
    `  ${verdict(result).padEnd(5)} ${result.id.padEnd(18)} ${String(result.productionMinutes).padStart(4)} min prod-equivalent   ${result.localMs} ms local`,
  );
}
console.log(`\n${results.length - failed.length}/${results.length} suites passed in ${((Date.now() - started) / 1000).toFixed(1)} s locally.`);
console.log(`Production-equivalent time: ${(scopedMinutes / 60).toFixed(1)} h of ${(fullMinutes / 60).toFixed(1)} h full regression.\n`);
if (flaky.length) console.log(`Flaky (failed, then passed on retry): ${flaky.join(', ')}. See docs/runbooks/README.md#flaky-suite.\n`);

mkdirSync(join(ROOT, 'out'), { recursive: true });
writeFileSync(join(ROOT, 'out/regression.json'), `${JSON.stringify({ mode, retries, results, scopedMinutes, fullMinutes }, null, 2)}\n`);
const summary = [
  `## Regression: ${mode}`,
  '',
  `${results.length - failed.length}/${results.length} suites passed. ${(scopedMinutes / 60).toFixed(1)} h of ${(fullMinutes / 60).toFixed(1)} h production-equivalent.`,
  '',
  '| Result | Suite | Owner | Attempts | Local ms |',
  '| --- | --- | --- | --- | --- |',
  ...results.map((result) => `| ${verdict(result)} | ${result.id} | ${result.owner} | ${result.attempts} | ${result.localMs} |`),
  '',
  ...(flaky.length ? [`**Flaky:** ${flaky.join(', ')}. Follow docs/runbooks/README.md#flaky-suite.`, ''] : []),
];
writeFileSync(join(ROOT, 'out/regression.md'), `${summary.join('\n')}\n`);
process.exit(failed.length || (failOnFlaky && flaky.length) ? 1 : 0);
