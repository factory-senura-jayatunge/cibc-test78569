#!/usr/bin/env node
// @ts-check
// Fails when a file that would be committed is too large. JavaScript line budgets are enforced by
// ESLint (max-lines); this catches large binaries, data dumps, and generated files of any type.
// Usage: node scripts/check-file-size.js [--staged] [file ...]
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib/graph.js';

export const MAX_BYTES = 256 * 1024;
// Lockfiles are generated and reviewed as a diff, not read whole.
const EXEMPT = new Set(['package-lock.json']);

/** @param {string} cwd @param {string[]} gitArgs */
const git = (cwd, gitArgs) => execFileSync('git', gitArgs, { cwd, encoding: 'utf8' });

// Without -z, Git quotes paths with non-ASCII characters, tabs, or newlines, and the quoted form
// does not exist on disk.
/** @param {string} cwd @param {string[]} gitArgs */
const gitPaths = (cwd, gitArgs) =>
  git(cwd, [...gitArgs, '-z'])
    .split('\0')
    .filter(Boolean);

/**
 * @param {{ cwd?: string, staged?: boolean, explicit?: string[] }} [options]
 * @returns {{ checked: number, oversized: { file: string, bytes: number }[] }}
 */
export function findOversized({ cwd = ROOT, staged = false, explicit = [] } = {}) {
  const fromIndex = staged && !explicit.length;
  const files = explicit.length
    ? explicit
    : fromIndex
      ? gitPaths(cwd, ['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
      : [...gitPaths(cwd, ['ls-files']), ...gitPaths(cwd, ['ls-files', '--others', '--exclude-standard'])];
  // A commit contains the staged blob, not the working copy, so staged mode measures the index.
  /** @param {string} file */
  const sizeOf = (file) =>
    fromIndex ? Number(git(cwd, ['cat-file', '-s', `:${file}`])) : existsSync(join(cwd, file)) ? statSync(join(cwd, file)).size : 0;
  const oversized = files
    .filter((file) => !EXEMPT.has(file))
    .map((file) => ({ file, bytes: sizeOf(file) }))
    .filter(({ bytes }) => bytes > MAX_BYTES);
  return { checked: files.length, oversized };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const { checked, oversized } = findOversized({ staged: args.includes('--staged'), explicit: args.filter((arg) => !arg.startsWith('--')) });
  if (oversized.length) {
    console.error(`Files over ${MAX_BYTES / 1024} KB:`);
    for (const { file, bytes } of oversized) console.error(`  ${file}  ${(bytes / 1024).toFixed(0)} KB`);
    console.error('Keep generated output in out/ (gitignored), or split the file. Binary assets need a reviewer to agree first.');
    process.exit(1);
  }
  console.log(`File size check passed: ${checked} files, none over ${MAX_BYTES / 1024} KB.`);
}
