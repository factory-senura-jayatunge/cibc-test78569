#!/usr/bin/env node
// @ts-check
// Change-impact analysis: which regression suites does this change actually need?
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MANIFEST_FILES, ROOT, buildImportGraph, couplingKind, domainOf, listFiles, readJson, sha256 } from './lib/graph.js';
import { dependencyVersions, diffDependencies } from './lib/dependencies.js';
import { flagValue } from './lib/cli.js';

/** @typedef {import('./lib/graph.js').Catalog} Catalog */
/** @typedef {import('./lib/graph.js').Suite} Suite */
/** @typedef {import('./lib/graph.js').SelectedSuite} SelectedSuite */
/** @typedef {import('./lib/graph.js').Coupling} Coupling */

const flag = flagValue;

/** @param {string} base */
function changedFromGit(base) {
  /** @param {string[]} gitArgs */
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
  const tracked = ['src', 'tests', 'public', 'regression'].flatMap((dir) => listFiles(dir));
  tracked.push(...MANIFEST_FILES.filter((file) => existsSync(join(ROOT, file))));
  const current = Object.fromEntries(tracked.map((file) => [file, sha256(file)]));
  const changed = Object.keys(current).filter((file) => manifest.files[file] !== current[file]);
  const deleted = Object.keys(manifest.files).filter((file) => !(file in current));
  return [...changed, ...deleted].sort();
}

const explicit = flag('--files');
const base = flag('--base');
const changed = explicit ? explicit.split(',').map((file) => file.trim()) : base ? changedFromGit(base) : changedFromBaseline();
const source = base ? `git diff ${base}` : explicit ? '--files' : 'release baseline (.baseline/manifest.json)';

/**
 * The previous package.json for the active comparison mode, when one can be read.
 * @returns {import('./lib/dependencies.js').PackageManifest | undefined}
 */
function previousManifest() {
  try {
    if (base) return JSON.parse(execFileSync('git', ['show', `${base}:package.json`], { cwd: ROOT, encoding: 'utf8' }));
    if (!explicit) {
      const snapshot = join(ROOT, '.baseline/snapshot/package.json');
      if (existsSync(snapshot)) return JSON.parse(readFileSync(snapshot, 'utf8'));
    }
  } catch {
    // Fall through: without a before-state the widest safe scope applies.
  }
  return undefined;
}

/**
 * Dependencies added, removed, or re-versioned by this change. A `--files` prediction has no
 * before-state, so every declared dependency counts; likewise when the previous manifest is
 * unreadable.
 * @returns {{ names: string[], attributed: boolean }}
 */
function changedDependencyNames() {
  if (!changed.some((file) => MANIFEST_FILES.includes(file))) return { names: [], attributed: true };
  const before = explicit ? undefined : previousManifest();
  if (!before) return { names: Object.keys(dependencyVersions(readJson('package.json'))).sort(), attributed: false };
  return { names: diffDependencies(before, readJson('package.json')), attributed: true };
}

const catalog = /** @type {Catalog} */ (readJson('regression/catalog.json'));
const { dependents, packageImporters } = buildImportGraph();

const changedPackages = changedDependencyNames();
/** @type {Map<string, string>} importer file -> changed package that pulled it in */
const importedChangedPackage = new Map();
for (const name of changedPackages.names) {
  for (const importer of packageImporters.get(name) ?? []) {
    if (!importedChangedPackage.has(importer)) importedChangedPackage.set(importer, name);
  }
}

/** @type {Map<string, string | null>} */
const parent = new Map();
/** @type {string[]} */
const queue = [];
for (const file of [...changed, ...importedChangedPackage.keys()]) {
  if (dependents.has(file) && !parent.has(file)) {
    parent.set(file, null);
    queue.push(file);
  }
}
while (queue.length) {
  const file = /** @type {string} */ (queue.shift());
  for (const dependent of dependents.get(file) ?? []) {
    if (parent.has(dependent)) continue;
    parent.set(dependent, file);
    queue.push(dependent);
  }
}
const impacted = [...parent.keys()];

/** @param {string} file */
const chainTo = (file) => {
  /** @type {string[]} */
  const chain = [];
  for (let node = /** @type {string | null | undefined} */ (file); node; node = parent.get(node)) chain.unshift(node);
  return chain;
};

/** @type {SelectedSuite[]} */
const selected = [];
/** @type {{ id: string, owner: string, productionMinutes: number }[]} */
const skipped = [];
for (const suite of catalog.suites) {
  const hit = suite.covers.find((file) => parent.has(file));
  let reason;
  /** @type {string[]} */
  let chain = [];
  if (hit) {
    chain = chainTo(hit);
    reason = chain.length === 1 ? `${hit} changed` : chain.join(' -> ');
    const seedPackage = importedChangedPackage.get(chain[0]);
    if (seedPackage) reason += ` (${chain[0]} imports ${seedPackage}, changed in the package manifest)`;
    if (changed.includes(suite.file)) reason += ' (suite updated)';
  } else if (changed.includes(suite.file)) reason = 'suite file changed';
  else if (suite.always) reason = 'always runs';
  if (reason) selected.push({ id: suite.id, owner: suite.owner, file: suite.file, productionMinutes: suite.productionMinutes, reason, chain });
  else skipped.push({ id: suite.id, owner: suite.owner, productionMinutes: suite.productionMinutes });
}

const registered = new Set(catalog.suites.map((suite) => suite.file));
const unregisteredTests = changed.filter((file) => file.startsWith('tests/') && !registered.has(file) && existsSync(join(ROOT, file)));

/** @type {Coupling[]} */
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

/** @param {{ productionMinutes: number }[]} suites */
const sum = (suites) => suites.reduce((total, suite) => total + suite.productionMinutes, 0);
const fullMinutes = sum(catalog.suites);
const scopedMinutes = sum(selected);
/** @param {number} minutes */
const hours = (minutes) => (minutes / 60).toFixed(1);
const saved = fullMinutes ? Math.round((1 - scopedMinutes / fullMinutes) * 100) : 0;
const impactedLobs = [
  ...new Set(
    impacted
      .map(domainOf)
      .filter((domain) => domain.startsWith('lob:'))
      .map((d) => d.slice(4)),
  ),
];
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
  changedPackages: changedPackages.names,
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
  ...(changed.some((file) => MANIFEST_FILES.includes(file))
    ? [
        `**Changed packages:** ${
          changedPackages.names.join(', ') ||
          (changedPackages.attributed
            ? 'none (manifest touched without a version change)'
            : 'unattributed, so every declared dependency counts as changed')
        }`,
        '',
      ]
    : []),
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

/**
 * @param {unknown} value
 * @param {number} width
 */
const pad = (value, width) => String(value).padEnd(width);
console.log(`\nChange impact analysis  (compared against ${source})\n`);
console.log(`Changed files (${changed.length}):`);
for (const file of changed) console.log(`  ${pad(file, 44)} [${domainOf(file)}]`);
if (!runtimeChanged) console.log('  No runtime code or tests changed. Only the smoke suite is required.');
if (changed.some((file) => MANIFEST_FILES.includes(file))) {
  const note = changedPackages.attributed ? '' : ' (unattributed, so every declared dependency counts as changed)';
  console.log(`Changed packages: ${changedPackages.names.join(', ') || 'none'}${note}`);
}
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
