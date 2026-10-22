#!/usr/bin/env node
// @ts-check
// Keeps AGENTS.md (and the docs agents read next) consistent with the code:
//   1. every `npm test`, `npm start`, and `npm run <script>` they mention exists in package.json,
//   2. every repository path in backticks, and every relative Markdown link, exists,
//   3. the known boundary-violation imports listed in AGENTS.md match the real import graph.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { ROOT, buildImportGraph, couplingKind, readJson } from './lib/graph.js';

const DOCS = ['AGENTS.md', 'README.md', 'CONTRIBUTING.md', 'docs/regression.md', 'docs/release-process.md'];
const PATH_ROOTS = /^(?:src|tests|scripts|docs|regression|public|\.github|\.factory|\.devcontainer)\//;
const PLACEHOLDER = /<[^>]+>/;

const scripts = new Set(Object.keys(/** @type {{ scripts: Record<string, string> }} */ (readJson('package.json')).scripts));
/** @type {string[]} */
const problems = [];

/**
 * @param {string} doc
 * @param {string} text
 */
function checkCommands(doc, text) {
  for (const [, name] of text.matchAll(/\bnpm run ([\w:.*-]+)/g)) {
    const known = name.endsWith('*') ? [...scripts].some((script) => script.startsWith(name.slice(0, -1))) : scripts.has(name);
    if (!known) problems.push(`${doc}: \`npm run ${name}\` is not a script in package.json`);
  }
  for (const [, name] of text.matchAll(/\bnpm (test|start)\b/g)) {
    if (!scripts.has(name)) problems.push(`${doc}: \`npm ${name}\` has no "${name}" script in package.json`);
  }
}

/**
 * @param {string} doc
 * @param {string} text
 */
function checkPaths(doc, text) {
  for (const [, span] of text.matchAll(/`([^`\n]+)`/g)) {
    const candidate = span.split(/\s/)[0].replace(/[,.:;)]+$/, '');
    if (!PATH_ROOTS.test(candidate)) continue;
    // `src/lob/<lob>/` style placeholders: the directory before the placeholder must exist.
    const concrete = PLACEHOLDER.test(candidate) ? candidate.slice(0, candidate.search(PLACEHOLDER)) : candidate;
    if (!existsSync(join(ROOT, concrete))) problems.push(`${doc}: \`${candidate}\` does not exist`);
  }
  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(?:[a-z]+:|#)/.test(target)) continue;
    const file = normalize(join(dirname(join(ROOT, doc)), target.split('#')[0]));
    if (!existsSync(file)) problems.push(`${doc}: link target ${target} does not exist`);
  }
}

/** @param {string} text */
function checkKnownDebt(text) {
  const documented = [...text.matchAll(/`([\w./-]+\.js) -> ([\w./-]+\.js)`/g)].map(([, from, to]) => ({ from, to }));
  const { imports } = buildImportGraph();
  const actual = [...imports].flatMap(([from, targets]) =>
    [...targets].filter((to) => (couplingKind(from, to) ?? 'lob-uses-platform') !== 'lob-uses-platform').map((to) => ({ from, to })),
  );
  for (const edge of documented) {
    if (!actual.some((real) => real.from.endsWith(edge.from) && real.to.endsWith(edge.to))) {
      problems.push(`AGENTS.md: known debt \`${edge.from} -> ${edge.to}\` no longer exists. Remove it from AGENTS.md and eslint.config.js.`);
    }
  }
  for (const real of actual) {
    if (!documented.some((edge) => real.from.endsWith(edge.from) && real.to.endsWith(edge.to))) {
      problems.push(`AGENTS.md: boundary violation \`${real.from} -> ${real.to}\` is not listed as known debt`);
    }
  }
}

function checkOpenApi() {
  const server = readFileSync(join(ROOT, 'src/server.js'), 'utf8');
  const implemented = new Set([...server.matchAll(/path: '(\/api\/[^']*)'/g)].map(([, path]) => path.replace(/:(\w+)/g, '{$1}')));
  const spec = readFileSync(join(ROOT, 'docs/openapi.yaml'), 'utf8');
  const documented = new Set([...spec.matchAll(/^ {2}(\/api\/\S*):$/gm)].map(([, path]) => path));
  for (const path of implemented) if (!documented.has(path)) problems.push(`docs/openapi.yaml: route ${path} in src/server.js is not documented`);
  for (const path of documented) if (!implemented.has(path)) problems.push(`docs/openapi.yaml: ${path} is not a route in src/server.js`);
}

checkOpenApi();
for (const doc of DOCS) {
  const text = readFileSync(join(ROOT, doc), 'utf8');
  checkCommands(doc, text);
  checkPaths(doc, text);
  if (doc === 'AGENTS.md') checkKnownDebt(text);
}

if (problems.length) {
  console.error(`Documentation is out of date (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`Docs check passed: ${DOCS.join(', ')}.`);
