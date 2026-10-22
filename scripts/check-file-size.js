#!/usr/bin/env node
// @ts-check
// Fails when a file that would be committed is too large. JavaScript line budgets are enforced by
// ESLint (max-lines); this catches large binaries, data dumps, and generated files of any type.
// Usage: node scripts/check-file-size.js [--staged] [file ...]
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/graph.js';

const MAX_BYTES = 256 * 1024;
// Lockfiles are generated and reviewed as a diff, not read whole.
const EXEMPT = new Set(['package-lock.json']);

/** @param {string[]} gitArgs */
const git = (gitArgs) => execFileSync('git', gitArgs, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);

const args = process.argv.slice(2);
const explicit = args.filter((arg) => !arg.startsWith('--'));
const files = explicit.length
  ? explicit
  : args.includes('--staged')
    ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
    : [...git(['ls-files']), ...git(['ls-files', '--others', '--exclude-standard'])];

const oversized = files
  .filter((file) => !EXEMPT.has(file) && existsSync(join(ROOT, file)))
  .map((file) => ({ file, bytes: statSync(join(ROOT, file)).size }))
  .filter(({ bytes }) => bytes > MAX_BYTES);

if (oversized.length) {
  console.error(`Files over ${MAX_BYTES / 1024} KB:`);
  for (const { file, bytes } of oversized) console.error(`  ${file}  ${(bytes / 1024).toFixed(0)} KB`);
  console.error('Keep generated output in out/ (gitignored), or split the file. Binary assets need a reviewer to agree first.');
  process.exit(1);
}
console.log(`File size check passed: ${files.length} files, none over ${MAX_BYTES / 1024} KB.`);
