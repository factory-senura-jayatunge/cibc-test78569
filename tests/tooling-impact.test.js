// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dependencyVersions, diffDependencies, packageName } from '../scripts/lib/dependencies.js';
import { ROOT, buildImportGraph, readJson } from '../scripts/lib/graph.js';

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
