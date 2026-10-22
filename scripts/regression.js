#!/usr/bin/env node
// Runs regression suites from the catalogue and reports results with production-equivalent timings.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson } from './lib/graph.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const catalog = readJson('regression/catalog.json');
let suites;
let mode;
if (args.includes('--all')) {
  suites = catalog.suites;
  mode = 'full regression';
} else if (flag('--suites')) {
  const ids = new Set(flag('--suites').split(','));
  suites = catalog.suites.filter((suite) => ids.has(suite.id));
  mode = 'selected suites';
} else {
  const impactPath = flag('--from-impact') ?? 'out/impact.json';
  if (!existsSync(join(ROOT, impactPath))) {
    console.error(`No impact report at ${impactPath}. Run \`npm run impact\` first.`);
    process.exit(2);
  }
  const ids = new Set(readJson(impactPath).selected.map((suite) => suite.id));
  suites = catalog.suites.filter((suite) => ids.has(suite.id));
  mode = `scoped by ${impactPath}`;
}

const results = [];
const started = Date.now();
for (const suite of suites) {
  const t0 = Date.now();
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=spec', suite.file], { cwd: ROOT, encoding: 'utf8' });
  const passed = run.status === 0;
  results.push({ id: suite.id, owner: suite.owner, passed, localMs: Date.now() - t0, productionMinutes: suite.productionMinutes });
  if (!passed) {
    console.log(`\n--- ${suite.id} failed ---\n${run.stdout}${run.stderr}`);
  }
}

const fullMinutes = catalog.suites.reduce((total, suite) => total + suite.productionMinutes, 0);
const scopedMinutes = results.reduce((total, suite) => total + suite.productionMinutes, 0);
const failed = results.filter((result) => !result.passed);

console.log(`\nRegression run: ${mode}\n`);
for (const result of results) {
  console.log(`  ${result.passed ? 'PASS' : 'FAIL'}  ${result.id.padEnd(18)} ${String(result.productionMinutes).padStart(4)} min prod-equivalent   ${result.localMs} ms local`);
}
console.log(`\n${results.length - failed.length}/${results.length} suites passed in ${((Date.now() - started) / 1000).toFixed(1)} s locally.`);
console.log(`Production-equivalent time: ${(scopedMinutes / 60).toFixed(1)} h of ${(fullMinutes / 60).toFixed(1)} h full regression.\n`);

mkdirSync(join(ROOT, 'out'), { recursive: true });
writeFileSync(join(ROOT, 'out/regression.json'), `${JSON.stringify({ mode, results, scopedMinutes, fullMinutes }, null, 2)}\n`);
process.exit(failed.length ? 1 : 0);
