// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dependencyVersions, diffDependencies, packageName } from '../scripts/lib/dependencies.js';
import { ROOT, buildImportGraph, readJson } from '../scripts/lib/graph.js';
import { toSarif } from '../scripts/audit-to-sarif.js';

test('READINESS-2 AC1: import specifiers resolve to their package root', () => {
  assert.equal(packageName('lodash'), 'lodash');
  assert.equal(packageName('lodash/template.js'), 'lodash');
  assert.equal(packageName('@eslint/js'), '@eslint/js');
  assert.equal(packageName('./advisory.js'), null);
  assert.equal(packageName('../../platform/audit.js'), null);
  assert.equal(packageName('node:fs'), null);
});

test('READINESS-2 AC2: manifest diffs report added, removed, and re-versioned dependencies only', () => {
  const before = {
    dependencies: { lodash: '4.17.20', leftpad: '1.0.0' },
    devDependencies: { eslint: '10.12.0' },
    scripts: { test: 'node --test' },
  };
  const after = {
    dependencies: { lodash: '4.17.21' },
    devDependencies: { eslint: '10.12.0', knip: '6.41.0' },
    scripts: { test: 'node --test tests/' },
  };
  assert.deepEqual(diffDependencies(before, after), ['knip', 'leftpad', 'lodash']);
  assert.deepEqual(diffDependencies(before, before), []);
  assert.deepEqual(dependencyVersions(after), { lodash: '4.17.21', eslint: '10.12.0', knip: '6.41.0' });
});

test('READINESS-2 AC3: the import graph maps a package to the source files that import it', () => {
  const { packageImporters } = buildImportGraph();
  assert.deepEqual([...(packageImporters.get('lodash') ?? [])], ['src/lob/wood-gundy/disclosure.js']);
  assert.ok(!packageImporters.has('node:fs'), 'node builtins are not packages');
});

test('READINESS-2 AC4: a manifest change scopes regression to smoke, wg-disclosure, and wg-statements', () => {
  execFileSync(process.execPath, ['scripts/impact.js', '--files', 'package.json,package-lock.json'], { cwd: ROOT, stdio: 'pipe' });
  const prediction = readJson('out/impact-prediction.json');
  assert.deepEqual(prediction.selected.map((/** @type {{ id: string }} */ suite) => suite.id).sort(), ['smoke', 'wg-disclosure', 'wg-statements']);
  // A --files prediction has no before-state, so every declared dependency counts as changed.
  assert.ok(prediction.changedPackages.includes('lodash'));
  const wg = prediction.selected.find((/** @type {{ id: string }} */ suite) => suite.id === 'wg-disclosure');
  assert.match(wg.reason, /imports lodash/);
});

const AUDIT_FIXTURE = {
  auditReportVersion: 2,
  vulnerabilities: {
    lodash: {
      name: 'lodash',
      severity: 'high',
      isDirect: true,
      via: [
        {
          source: 1106913,
          title: 'Command Injection in lodash',
          url: 'https://github.com/advisories/GHSA-35jh-r3h4-6jhm',
          severity: 'high',
          range: '<4.17.21',
          cvss: { score: 7.2 },
        },
        {
          source: 1108258,
          title: 'Regular Expression Denial of Service (ReDoS) in lodash',
          url: 'https://github.com/advisories/GHSA-29mw-wpgm-hmr9',
          severity: 'moderate',
          range: '>=4.0.0 <4.17.21',
          cvss: { score: 5.3 },
        },
        'lodash',
      ],
      range: '<4.17.21',
      fixAvailable: { name: 'lodash', version: '4.17.21' },
    },
  },
};

test('READINESS-2 AC5: npm audit JSON converts to SARIF with one rule per advisory', () => {
  const sarif = toSarif(AUDIT_FIXTURE, '2026-10-22T15:04:33.000Z');
  assert.equal(sarif.version, '2.1.0');
  assert.equal(sarif.$schema, 'https://json.schemastore.org/sarif-2.1.0.json');
  const [run] = sarif.runs;
  assert.equal(run.tool.driver.name, 'npm audit');
  assert.deepEqual(
    run.tool.driver.rules.map((/** @type {{ id: string }} */ rule) => rule.id),
    ['GHSA-35jh-r3h4-6jhm', 'GHSA-29mw-wpgm-hmr9'],
  );
  assert.equal(run.results.length, 2, 'the transitive string marker is not an advisory');
  const [injection] = run.results;
  assert.equal(injection.ruleId, 'GHSA-35jh-r3h4-6jhm');
  assert.match(injection.message.text, /lodash <4\.17\.21: Command Injection/);
  assert.match(injection.message.text, /Fixed by lodash@4\.17\.21/);
  assert.equal(injection.locations[0].physicalLocation.artifactLocation.uri, 'package-lock.json');
  assert.equal(injection.partialFingerprints['npm-audit/package-advisory'], 'lodash/GHSA-35jh-r3h4-6jhm');
  assert.equal(run.invocations[0].startTimeUtc, '2026-10-22T15:04:33.000Z');
});

test('READINESS-2 AC5: advisory severities map to SARIF levels', () => {
  const [run] = toSarif(AUDIT_FIXTURE).runs;
  assert.equal(run.results[0].level, 'error', 'high maps to error');
  assert.equal(run.results[1].level, 'warning', 'moderate maps to warning');
});
