#!/usr/bin/env node
// Change-impact analysis: which regression suites does this change actually need?
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, buildImportGraph, couplingKind, domainOf, listFiles, readJson, sha256 } from './lib/graph.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

function changedFromGit(base) {
  const run = (gitArgs) => execFileSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  return [...new Set([...run(['diff', '--name-only', base]), ...run(['ls-files', '--others', '--exclude-standard'])])];
}

function changedFromBaseline() {
  const manifestPath = join(ROOT, '.baseline/manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('No release baseline found. Run `npm run baseline` first, or pass --base <git-ref>.');
    process.exit(2);
  }
  const manifest = readJson('.baseline/manifest.json');
  const current = Object.fromEntries(
    ['src', 'tests', 'public', 'regression'].flatMap((dir) => listFiles(dir)).map((file) => [file, sha256(file)]),
  );
  const changed = Object.keys(current).filter((file) => manifest.files[file] !== current[file]);
  const deleted = Object.keys(manifest.files).filter((file) => !(file in current));
  return [...changed, ...deleted].sort();
}

const explicit = flag('--files');
const base = flag('--base');
const changed = explicit ? explicit.split(',').map((file) => file.trim()) : base ? changedFromGit(base) : changedFromBaseline();
const source = base ? `git diff ${base}` : explicit ? '--files' : 'release baseline (.baseline/manifest.json)';

const catalog = readJson('regression/catalog.json');
const { dependents } = buildImportGraph();

const parent = new Map();
const queue = [];
for (const file of changed) {
  if (dependents.has(file) && !parent.has(file)) {
    parent.set(file, null);
    queue.push(file);
  }
}
while (queue.length) {
  const file = queue.shift();
  for (const dependent of dependents.get(file)) {
    if (parent.has(dependent)) continue;
    parent.set(dependent, file);
    queue.push(dependent);
  }
}
const impacted = [...parent.keys()];

const chainTo = (file) => {
  const chain = [];
  for (let node = file; node; node = parent.get(node)) chain.unshift(node);
  return chain;
};

const selected = [];
const skipped = [];
for (const suite of catalog.suites) {
  const hit = suite.covers.find((file) => parent.has(file));
  let reason;
  let chain = [];
  if (hit) {
    chain = chainTo(hit);
    reason = chain.length === 1 ? `${hit} changed` : chain.join(' -> ');
    if (changed.includes(suite.file)) reason += ' (suite updated)';
  } else if (changed.includes(suite.file)) reason = 'suite file changed';
  else if (suite.always) reason = 'always runs';
  if (reason) selected.push({ id: suite.id, owner: suite.owner, file: suite.file, productionMinutes: suite.productionMinutes, reason, chain });
  else skipped.push({ id: suite.id, owner: suite.owner, productionMinutes: suite.productionMinutes });
}

const registered = new Set(catalog.suites.map((suite) => suite.file));
const unregisteredTests = changed.filter((file) => file.startsWith('tests/') && !registered.has(file) && existsSync(join(ROOT, file)));

const couplings = [];
const seen = new Set();
for (const suite of selected) {
  for (let i = 1; i < suite.chain.length; i += 1) {
    const dependency = suite.chain[i - 1];
    const dependent = suite.chain[i];
    const kind = couplingKind(dependent, dependency);
    const key = `${dependent}>${dependency}`;
    if (kind && kind !== 'lob-uses-platform' && !seen.has(key)) {
      seen.add(key);
      couplings.push({ from: dependent, to: dependency, kind });
    }
  }
}

const sum = (suites) => suites.reduce((total, suite) => total + suite.productionMinutes, 0);
const fullMinutes = sum(catalog.suites);
const scopedMinutes = sum(selected);
const hours = (minutes) => (minutes / 60).toFixed(1);
const saved = fullMinutes ? Math.round((1 - scopedMinutes / fullMinutes) * 100) : 0;
const impactedLobs = [...new Set(impacted.map(domainOf).filter((domain) => domain.startsWith('lob:')).map((d) => d.slice(4)))];
const runtimeChanged = changed.some((file) => file.startsWith('src/') || file.startsWith('tests/') || file.startsWith('public/'));

const result = {
  generatedAt: new Date().toISOString(),
  source,
  changed,
  impacted,
  impactedLinesOfBusiness: impactedLobs,
  selected,
  skipped,
  unregisteredTests,
  couplings,
  scopedMinutes,
  fullMinutes,
  percentSaved: saved,
};

mkdirSync(join(ROOT, 'out'), { recursive: true });
// A --files run is a prediction for planned work; it must not replace the report that regression:scoped reads.
const outName = explicit ? 'impact-prediction' : 'impact';
writeFileSync(join(ROOT, `out/${outName}.json`), `${JSON.stringify(result, null, 2)}\n`);

const md = [
  '## Change impact',
  '',
  `Compared against: ${source}`,
  '',
  `**Changed files (${changed.length})**`,
  ...changed.map((file) => `- \`${file}\``),
  '',
  `**Lines of business affected:** ${impactedLobs.length ? impactedLobs.join(', ') : 'none'}`,
  '',
  `**Regression scope:** ${selected.length} of ${catalog.suites.length} suites, ${hours(scopedMinutes)} h of ${hours(fullMinutes)} h production-equivalent (${saved}% less than full regression)`,
  '',
  '| Suite | Owner | Est. prod time | Why it runs |',
  '| --- | --- | --- | --- |',
  ...selected.map((suite) => `| ${suite.id} | ${suite.owner} | ${suite.productionMinutes} min | ${suite.reason.replaceAll('->', '→')} |`),
  '',
  `Skipped: ${skipped.map((suite) => suite.id).join(', ') || 'none'}`,
  '',
  ...(couplings.length
    ? ['**Coupling that widened this change**', ...couplings.map((c) => `- \`${c.from}\` imports \`${c.to}\` (${c.kind})`), '']
    : []),
  ...(unregisteredTests.length
    ? ['**Unregistered test files** (add them to `regression/catalog.json`)', ...unregisteredTests.map((f) => `- \`${f}\``), '']
    : []),
].join('\n');
writeFileSync(join(ROOT, `out/${outName}-report.md`), `${md}\n`);

const pad = (value, width) => String(value).padEnd(width);
console.log(`\nChange impact analysis  (compared against ${source})\n`);
console.log(`Changed files (${changed.length}):`);
for (const file of changed) console.log(`  ${pad(file, 44)} [${domainOf(file)}]`);
if (!runtimeChanged) console.log('  No runtime code or tests changed. Only the smoke suite is required.');
console.log(`\nLines of business affected: ${impactedLobs.length ? impactedLobs.join(', ') : 'none'}`);
console.log(`\nSelected regression suites: ${selected.length} of ${catalog.suites.length}`);
for (const suite of selected) console.log(`  + ${pad(suite.id, 18)} ${pad(`${suite.productionMinutes} min`, 9)} ${suite.reason}`);
console.log(`\nSkipped (${skipped.length}): ${skipped.map((suite) => `${suite.id} (${suite.productionMinutes} min)`).join(', ') || 'none'}`);
if (couplings.length) {
  console.log('\nCoupling that widened the blast radius:');
  for (const c of couplings) console.log(`  ! ${c.from} imports ${c.to}  (${c.kind})`);
}
if (unregisteredTests.length) {
  console.log('\nUnregistered test files (add to regression/catalog.json):');
  for (const file of unregisteredTests) console.log(`  ? ${file}`);
}
console.log(`\nProduction-equivalent regression: ${hours(scopedMinutes)} h scoped vs ${hours(fullMinutes)} h full  (${saved}% less)`);
console.log(`Wrote out/${outName}.json and out/${outName}-report.md\n`);
