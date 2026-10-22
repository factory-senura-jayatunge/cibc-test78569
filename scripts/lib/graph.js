// @ts-check
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/g;

/**
 * @typedef {object} Suite
 * @property {string} id
 * @property {string} owner
 * @property {string} file
 * @property {string[]} covers
 * @property {number} productionMinutes
 * @property {boolean} [always]
 */
/** @typedef {{ productionBaseline: { fullRegressionHours: number, note: string }, suites: Suite[] }} Catalog */
/** @typedef {'platform-depends-on-lob' | 'lob-depends-on-lob' | 'lob-uses-platform'} CouplingKind */
/** @typedef {{ from: string, to: string, kind: CouplingKind }} Coupling */
/** @typedef {{ id: string, owner: string, file: string, productionMinutes: number, reason: string, chain: string[] }} SelectedSuite */
/**
 * Shape of out/impact.json and out/impact-prediction.json.
 * @typedef {object} ImpactResult
 * @property {string} generatedAt
 * @property {string} source
 * @property {string[]} changed
 * @property {string[]} impacted
 * @property {string[]} impactedLinesOfBusiness
 * @property {SelectedSuite[]} selected
 * @property {{ id: string, owner: string, productionMinutes: number }[]} skipped
 * @property {string[]} unregisteredTests
 * @property {Coupling[]} couplings
 * @property {number} scopedMinutes
 * @property {number} fullMinutes
 * @property {number} percentSaved
 */
/**
 * One suite in out/regression.json. A suite that failed and then passed on a retry is `flaky`.
 * @typedef {{ id: string, owner: string, passed: boolean, flaky: boolean, attempts: number, localMs: number, productionMinutes: number }} SuiteResult
 */
/** @typedef {{ mode: string, retries: number, results: SuiteResult[], flaky: string[], scopedMinutes: number, fullMinutes: number }} RegressionResult */

/**
 * @param {string} dir
 * @param {(file: string) => boolean} [predicate]
 * @returns {string[]}
 */
export function listFiles(dir, predicate = () => true) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} current */
  const walk = (current) => {
    let names;
    try {
      names = readdirSync(current);
    } catch {
      return;
    }
    for (const name of names) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (predicate(full)) out.push(relative(ROOT, full).split('\\').join('/'));
    }
  };
  walk(join(ROOT, dir));
  return out.sort();
}

/** @param {string} file */
export function sha256(file) {
  return createHash('sha256')
    .update(readFileSync(join(ROOT, file)))
    .digest('hex');
}

/** @param {string} file */
export function domainOf(file) {
  const lob = file.match(/^src\/lob\/([^/]+)\//);
  if (lob) return `lob:${lob[1]}`;
  if (file.startsWith('src/platform/')) return 'platform';
  if (file.startsWith('src/')) return 'entry';
  if (file.startsWith('tests/')) return 'test';
  return 'other';
}

export function buildImportGraph() {
  const files = listFiles('src', (file) => file.endsWith('.js'));
  /** @type {Map<string, Set<string>>} */
  const imports = new Map(files.map((file) => [file, new Set()]));
  /** @type {Map<string, Set<string>>} */
  const dependents = new Map(files.map((file) => [file, new Set()]));
  for (const file of files) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    for (const match of source.matchAll(IMPORT)) {
      const target = posix.normalize(posix.join(posix.dirname(file), match[1]));
      if (!imports.has(target)) continue;
      imports.get(file)?.add(target);
      dependents.get(target)?.add(file);
    }
  }
  return { files, imports, dependents };
}

/**
 * @param {string} fromFile
 * @param {string} toFile
 * @returns {CouplingKind | null}
 */
export function couplingKind(fromFile, toFile) {
  const from = domainOf(fromFile);
  const to = domainOf(toFile);
  if (from === to || (!['platform'].includes(from) && !from.startsWith('lob:'))) return null;
  if (from === 'platform' && to.startsWith('lob:')) return 'platform-depends-on-lob';
  if (from.startsWith('lob:') && to.startsWith('lob:')) return 'lob-depends-on-lob';
  return 'lob-uses-platform';
}

/**
 * @template [T=any]
 * @param {string} file
 * @returns {T}
 */
export function readJson(file) {
  return JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
}
