#!/usr/bin/env node
// @ts-check
// Records the current tree as the "last release" so impact analysis and demo resets work without git history.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MANIFEST_FILES, ROOT, listFiles, sha256 } from './lib/graph.js';

const DIRS = ['src', 'tests', 'public', 'regression'];
const tracked = DIRS.flatMap((dir) => listFiles(dir));
tracked.push(...MANIFEST_FILES.filter((file) => existsSync(join(ROOT, file))));
const files = Object.fromEntries(tracked.map((file) => [file, sha256(file)]));
const baselineDir = join(ROOT, '.baseline');
rmSync(baselineDir, { recursive: true, force: true });
mkdirSync(join(baselineDir, 'snapshot'), { recursive: true });
for (const dir of DIRS) cpSync(join(ROOT, dir), join(baselineDir, 'snapshot', dir), { recursive: true });
for (const file of MANIFEST_FILES) {
  if (existsSync(join(ROOT, file))) cpSync(join(ROOT, file), join(baselineDir, 'snapshot', file));
}
writeFileSync(join(baselineDir, 'manifest.json'), `${JSON.stringify({ createdAt: new Date().toISOString(), files }, null, 2)}\n`);
console.log(`Release baseline recorded: ${Object.keys(files).length} files.`);
